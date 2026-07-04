import {
  DEFAULT_AI_CAPABILITY,
  enhancedFromGeminiAvailability,
  mergeAICapability,
  type AICapabilityRecord,
} from './src/ai-capability';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './src/constants';
import { classifyWithRules } from './src/classifier';
import { editionFromPaid, getAuditLimit, sanitizeSettings } from './src/edition';
import {
  activateProLicense,
  deactivateProLicense,
  getLicenseStatus,
  isProUser,
  openProCheckoutPage,
} from './src/license-client';
import {
  isContentScriptSender,
  isExtensionPageSender,
  isExtensionSender,
  isOffscreenSender,
} from './src/ipc';
import { extensionApi, supportsOffscreenDocuments } from './src/platform';
import { isDomainMatch } from './src/utils';
import type {
  AuditEntry,
  ClassificationResult,
  Edition,
  GeminiAvailability,
  SourceCloakSettings,
  SourceCloakStats,
} from './src/types';

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

async function getAICapability(): Promise<AICapabilityRecord> {
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AI_CAPABILITY);
  const stored = data[STORAGE_KEYS.AI_CAPABILITY] as AICapabilityRecord | undefined;
  return stored ? { ...DEFAULT_AI_CAPABILITY, ...stored, enhanced: { ...DEFAULT_AI_CAPABILITY.enhanced, ...stored.enhanced } } : { ...DEFAULT_AI_CAPABILITY };
}

async function saveAICapability(capability: AICapabilityRecord): Promise<void> {
  await extensionApi.storage.local.set({ [STORAGE_KEYS.AI_CAPABILITY]: capability });
}

async function probeOnnxState(): Promise<Pick<AICapabilityRecord, 'onnxReady' | 'onnxState'>> {
  if (!supportsOffscreen) {
    return { onnxReady: false, onnxState: 'unsupported' };
  }

  try {
    await setupOffscreen();
    const response = await extensionApi.runtime.sendMessage<{
      success?: boolean;
      state?: AICapabilityRecord['onnxState'];
    }>({ type: 'check-offscreen-model-status' });

    const state = response?.state ?? 'idle';
    return {
      onnxState: state,
      onnxReady: state === 'ready',
    };
  } catch {
    return { onnxReady: false, onnxState: 'error' };
  }
}

async function probeEnhancedAI(tabId?: number): Promise<GeminiAvailability> {
  try {
    let targetTabId = tabId;

    if (!targetTabId) {
      const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        return 'unavailable';
      }
      targetTabId = tab.id;
    }

    const detected = await extensionApi.tabs.sendMessage<{
      success?: boolean;
      availability?: GeminiAvailability;
    }>(targetTabId, { type: 'sourcecloak-detect-enhanced-ai' });

    return detected?.availability ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function refreshAICapability(tabId?: number): Promise<AICapabilityRecord> {
  const [current, onnx] = await Promise.all([getAICapability(), probeOnnxState()]);
  const availability = await probeEnhancedAI(tabId);
  const next = mergeAICapability(current, {
    ...onnx,
    enhanced: enhancedFromGeminiAvailability(availability),
  });
  await saveAICapability(next);
  return next;
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
  refreshAICapability().catch(() => {});
});

extensionApi.runtime.onStartup?.addListener(async () => {
  await isProUser(true).catch(() => {});
  const settings = await getSettings();
  if (settings.enabled && supportsOffscreen) {
    setupOffscreen().catch(() => {});
  }
  refreshAICapability().catch(() => {});
});

extensionApi.storage.onChanged?.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
  if (!changes[STORAGE_KEYS.SETTINGS]) return;
  const settings = changes[STORAGE_KEYS.SETTINGS].newValue as SourceCloakSettings | undefined;
  if (settings?.enabled && supportsOffscreen) {
    setupOffscreen().catch(() => {});
  }
});

function isTrustedReader(sender: chrome.runtime.MessageSender): boolean {
  return isExtensionPageSender(sender) || isContentScriptSender(sender);
}

extensionApi.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  if (!isExtensionSender(sender)) return false;

  if (message.type === 'get-settings') {
    if (!isTrustedReader(sender)) return false;
    Promise.all([getSettings(), getEdition()])
      .then(([settings, edition]) => sendResponse({ success: true, settings, edition }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-edition') {
    if (!isExtensionPageSender(sender)) return false;
    getEdition()
      .then((edition) => sendResponse({ success: true, edition }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-license-status') {
    if (!isExtensionPageSender(sender)) return false;
    getLicenseStatus()
      .then((status) => sendResponse({ success: true, ...status }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'open-checkout-page') {
    if (!isExtensionPageSender(sender)) return false;
    openProCheckoutPage()
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'activate-license') {
    if (!isExtensionPageSender(sender)) return false;
    const licenseKey = message.licenseKey as string;
    activateProLicense(licenseKey)
      .then(async (status) => {
        if (!status.isPro) {
          sendResponse({
            success: false,
            error: status.error ?? 'License activation failed. Check your key and try again.',
          });
          return;
        }
        sendResponse({
          success: true,
          edition: 'pro' as Edition,
          customerEmail: status.customerEmail,
        });
      })
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'deactivate-license') {
    if (!isExtensionPageSender(sender)) return false;
    deactivateProLicense()
      .then(() => sendResponse({ success: true, edition: 'community' as Edition }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-stats') {
    if (!isExtensionPageSender(sender)) return false;
    getStats().then((stats) => sendResponse({ success: true, stats })).catch((err: Error) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'get-audit-log') {
    if (!isExtensionPageSender(sender)) return false;
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

  if (message.type === 'get-ai-capability') {
    if (!isExtensionPageSender(sender)) return false;
    getAICapability()
      .then((capability) => sendResponse({ success: true, capability }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'refresh-ai-capability') {
    if (!isExtensionPageSender(sender)) return false;
    refreshAICapability()
      .then((capability) => sendResponse({ success: true, capability }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'update-enhanced-ai-availability') {
    if (!isContentScriptSender(sender)) return false;
    (async () => {
      const availability = message.availability as GeminiAvailability;
      const current = await getAICapability();
      const onnx = await probeOnnxState();
      const next = mergeAICapability(current, {
        ...onnx,
        enhanced: enhancedFromGeminiAvailability(availability),
      });
      await saveAICapability(next);
      sendResponse({ success: true, capability: next });
    })().catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'get-gemini-availability') {
    if (!isExtensionPageSender(sender)) return false;
    (async () => {
      try {
        const capability = await getAICapability();
        if (capability.enhanced.checkedAt > 0 && capability.enhanced.geminiAvailability !== 'unknown') {
          sendResponse({
            success: true,
            availability: capability.enhanced.geminiAvailability,
            capability,
          });
          return;
        }

        const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
          sendResponse({ success: true, availability: 'unavailable', tabRestricted: true, capability });
          return;
        }

        const refreshed = await refreshAICapability(tab.id);
        sendResponse({
          success: true,
          availability: refreshed.enhanced.geminiAvailability,
          tabUrl: tab.url,
          capability: refreshed,
        });
      } catch {
        const capability = await getAICapability();
        sendResponse({ success: true, availability: 'unavailable', tabRestricted: false, capability });
      }
    })();
    return true;
  }

  if (message.type === 'check-model-status') {
    if (!isExtensionPageSender(sender)) return false;
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
    if (!isOffscreenSender(sender)) return false;
    (async () => {
      await extensionApi.storage.local.set({
        [STORAGE_KEYS.MODEL_STATE]: message.state,
        [STORAGE_KEYS.MODEL_PROGRESS]: message.progress,
      });

      const current = await getAICapability();
      const state = message.state as AICapabilityRecord['onnxState'];
      const next = mergeAICapability(current, {
        onnxState: state,
        onnxReady: state === 'ready',
      });
      await saveAICapability(next);
    })().catch(() => {});
    return false;
  }

  if (message.type === 'log-gemini-fallback') {
    if (!isOffscreenSender(sender)) return false;
    (async () => {
      const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AI_FALLBACK_LOGGED);
      if (data[STORAGE_KEYS.AI_FALLBACK_LOGGED]) return;
      await extensionApi.storage.local.set({ [STORAGE_KEYS.AI_FALLBACK_LOGGED]: Date.now() });
    })().catch(() => {});
    return false;
  }

  if (message.type === 'record-sync-block') {
    if (!isContentScriptSender(sender)) return false;
    updateStatsFromResult(message.result).catch(() => {});
    appendAuditEntry(message.entry).catch(() => {});
    return false;
  }

  if (message.type === 'classify-payload') {
    if (!isContentScriptSender(sender)) return false;
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