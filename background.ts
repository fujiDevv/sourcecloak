import { DEFAULT_SETTINGS, STORAGE_KEYS } from './src/constants';
import { classifyWithRules } from './src/classifier';
import { editionFromPaid, getAuditLimit, sanitizeSettings } from './src/edition';
import {
  createExtPay,
  isProUser,
  openProLoginPage,
  openProPaymentPage,
  startExtPayBackground,
} from './src/extpay-client';
import { extensionApi, supportsOffscreenDocuments } from './src/platform';
import { isDomainMatch } from './src/utils';
import type { AuditEntry, ClassificationResult, Edition, SourceCloakSettings, SourceCloakStats } from './src/types';

startExtPayBackground();

const extpay = createExtPay();
extpay.onPaid.addListener(async () => {
  const settings = await getSettings();
  await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
});

const supportsOffscreen = supportsOffscreenDocuments();
let creatingOffscreen: Promise<void> | null = null;

async function getEdition(): Promise<Edition> {
  return editionFromPaid(await isProUser());
}

async function getSettings(): Promise<SourceCloakSettings> {
  const [data, edition] = await Promise.all([
    extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.SETTINGS),
    getEdition(),
  ]);
  const raw = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] as Partial<SourceCloakSettings> | undefined) };
  return sanitizeSettings(raw, edition);
}

async function getStats(): Promise<SourceCloakStats> {
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.STATS);
  return (data[STORAGE_KEYS.STATS] as SourceCloakStats | undefined) ?? {
    totalScans: 0,
    totalBlocks: 0,
    blocksByCategory: {}
  };
}

async function saveStats(stats: SourceCloakStats): Promise<void> {
  await extensionApi.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}

async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const settings = await getSettings();
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AUDIT_LOG);
  const existing = (data[STORAGE_KEYS.AUDIT_LOG] as AuditEntry[] | undefined) ?? [];
  const cutoff = Date.now() - (settings.auditRetentionDays * 24 * 60 * 60 * 1000);
  
  const edition = await getEdition();
  const next = [entry, ...existing]
    .filter(e => e.timestamp > cutoff)
    .slice(0, getAuditLimit(edition));
    
  await extensionApi.storage.local.set({ [STORAGE_KEYS.AUDIT_LOG]: next });
}

async function updateStatsFromResult(result: ClassificationResult): Promise<void> {
  const stats = await getStats();
  stats.totalScans += 1;

  if (result.blocked) {
    stats.totalBlocks += 1;
    stats.lastBlockTime = Date.now();
    for (const match of result.matches) {
      stats.blocksByCategory[match.category] = (stats.blocksByCategory[match.category] ?? 0) + 1;
    }
  }

  await saveStats(stats);
}

async function setupOffscreen(): Promise<void> {
  if (!supportsOffscreen) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = (async () => {
    const contexts = await extensionApi.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] as chrome.runtime.ContextType[] });
    if (contexts && contexts.length > 0) return;

    const offscreenReason = extensionApi.offscreen.Reason;
    if (!offscreenReason) return;

    try {
      await extensionApi.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [offscreenReason.DOM_PARSER],
        justification: 'Run local ONNX and WASM classification for proprietary code leak interception'
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('Only a single offscreen document may be created')) {
        throw err;
      }
    }
  })();

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function classifyPayload(text: string, settings: SourceCloakSettings): Promise<ClassificationResult> {
  if (supportsOffscreen && (settings.useOnnxClassifier || settings.useGeminiNano)) {
    try {
      await setupOffscreen();
      const response = await extensionApi.runtime.sendMessage<{
        success: boolean;
        result?: ClassificationResult;
        error?: string;
      }>({
        type: 'run-offscreen-classification',
        text,
        settings
      });

      if (response?.success && response.result) {
        return response.result;
      }
    } catch (err) {
      console.warn('[SourceCloak] Offscreen classification failed, retrying once...', err);
      try {
        creatingOffscreen = null;
        await setupOffscreen();
        const response = await extensionApi.runtime.sendMessage<{
          success: boolean;
          result?: ClassificationResult;
          error?: string;
        }>({
          type: 'run-offscreen-classification',
          text,
          settings
        });
        if (response?.success && response.result) {
          return response.result;
        }
      } catch (retryErr) {
        console.warn('[SourceCloak] Offscreen classification failed after retry, using rules fallback:', retryErr);
      }
    }
  }

  return classifyWithRules(text, settings);
}

extensionApi.runtime.onInstalled?.addListener(async (details) => {
  if (details.reason === 'install') {
    await extensionApi.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.STATS]: {
        totalScans: 0,
        totalBlocks: 0,
        blocksByCategory: {}
      },
      [STORAGE_KEYS.AUDIT_LOG]: []
    });
    const optionsUrl = extensionApi.runtime.getURL('options/options.html?welcome=1');
    await extensionApi.tabs.create({ url: optionsUrl });
  }

  const settings = await getSettings();
  if (settings.enabled && supportsOffscreen) {
    setupOffscreen().catch(() => {});
  }
});

extensionApi.runtime.onStartup?.addListener(async () => {
  const settings = await getSettings();
  if (settings.enabled && supportsOffscreen) {
    setupOffscreen().catch(() => {});
  }
});

extensionApi.storage.onChanged?.addListener((changes) => {
  if (!changes[STORAGE_KEYS.SETTINGS]) return;
  const settings = changes[STORAGE_KEYS.SETTINGS].newValue as SourceCloakSettings | undefined;
  if (settings?.enabled && supportsOffscreen) {
    setupOffscreen().catch(() => {});
  }
});

extensionApi.runtime.onMessage?.addListener((message, _sender, sendResponse) => {
  if (message.type === 'get-settings') {
    Promise.all([getSettings(), getEdition()])
      .then(([settings, edition]) => sendResponse({ success: true, settings, edition }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-edition') {
    getEdition()
      .then((edition) => sendResponse({ success: true, edition }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-payment-user') {
    createExtPay().getUser()
      .then(async (user) => {
        const edition = editionFromPaid(user.paid);
        sendResponse({
          success: true,
          edition,
          email: user.email,
          paidAt: user.paidAt?.toISOString() ?? null,
          plan: user.plan,
        });
      })
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'open-payment-page') {
    openProPaymentPage()
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'open-login-page') {
    openProLoginPage()
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-stats') {
    getStats().then((stats) => sendResponse({ success: true, stats })).catch((err: Error) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'get-audit-log') {
    Promise.all([
      extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AUDIT_LOG),
      getEdition(),
    ])
      .then(([data, edition]) => {
        const entries = (data[STORAGE_KEYS.AUDIT_LOG] as AuditEntry[] | undefined) ?? [];
        sendResponse({ success: true, entries: entries.slice(0, getAuditLimit(edition)), edition });
      })
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'check-model-status') {
    if (!supportsOffscreen) {
      sendResponse({ success: true, state: 'unsupported', progress: 0 });
      return false;
    }

    setupOffscreen()
      .then(() => extensionApi.runtime.sendMessage({ type: 'check-offscreen-model-status' }))
      .then((res) => sendResponse(res))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'update-model-progress') {
    extensionApi.storage.local.set({
      [STORAGE_KEYS.MODEL_STATE]: message.state,
      [STORAGE_KEYS.MODEL_PROGRESS]: message.progress
    }).catch(() => {});
    return false;
  }

  if (message.type === 'record-sync-block') {
    updateStatsFromResult(message.result).catch(() => {});
    appendAuditEntry(message.entry).catch(() => {});
    return false;
  }

  if (message.type === 'classify-payload') {
    const { text, hostname, url, eventType, elementTag } = message;

    getSettings()
      .then(async (settings) => {
        if (!settings.enabled) {
          sendResponse({
            success: true,
            result: { blocked: false, score: 0, matches: [], processingMs: 0 }
          });
          return;
        }

        if (isDomainMatch(hostname, settings.trustedDomains)) {
          sendResponse({
            success: true,
            result: { blocked: false, score: 0, matches: [], processingMs: 0 }
          });
          return;
        }

        if (settings.monitoredDomains.length > 0 && !isDomainMatch(hostname, settings.monitoredDomains)) {
          sendResponse({
            success: true,
            result: { blocked: false, score: 0, matches: [], processingMs: 0 }
          });
          return;
        }

        const result = await classifyPayload(text, settings);
        await updateStatsFromResult(result);

        const entry: AuditEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          hostname,
          url,
          eventType,
          blocked: result.blocked,
          score: result.score,
          matches: result.matches,
          elementTag
        };

        await appendAuditEntry(entry);
        sendResponse({ success: true, result });
      })
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));

    return true;
  }

  return false;
});