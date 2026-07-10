/**
 * Background service helpers (settings, stats, audit, offscreen, AI capability).
 * Kept free of the chrome.runtime.onMessage switch so handlers stay thin.
 */
import {
  DEFAULT_AI_CAPABILITY,
  enhancedFromGeminiAvailability,
  mergeAICapability,
  type AICapabilityRecord,
} from './ai-capability';
import { allowResult, classifyWithRules } from './classifier';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';
import { editionFromPaid, getAuditLimit, sanitizeSettings } from './edition';
import { isProUser } from './license-client';
import { extensionApi, supportsOffscreenDocuments } from './platform';
import type {
  AuditEntry,
  ClassificationResult,
  Edition,
  GeminiAvailability,
  SourceCloakSettings,
  SourceCloakStats,
} from './types';

export const supportsOffscreen = supportsOffscreenDocuments();
let creatingOffscreen: Promise<void> | null = null;

export function resetOffscreenCreateLock(): void {
  creatingOffscreen = null;
}

export async function getEdition(): Promise<Edition> {
  return editionFromPaid(await isProUser());
}

export async function getSettings(): Promise<SourceCloakSettings> {
  const [data, edition] = await Promise.all([
    extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.SETTINGS),
    getEdition(),
  ]);
  const raw = {
    ...DEFAULT_SETTINGS,
    ...(data[STORAGE_KEYS.SETTINGS] as Partial<SourceCloakSettings> | undefined),
  };
  return sanitizeSettings(raw, edition);
}

export async function getStats(): Promise<SourceCloakStats> {
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.STATS);
  return (
    (data[STORAGE_KEYS.STATS] as SourceCloakStats | undefined) ?? {
      totalScans: 0,
      totalBlocks: 0,
      blocksByCategory: {},
    }
  );
}

export async function saveStats(stats: SourceCloakStats): Promise<void> {
  await extensionApi.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}

export async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const [settings, data, edition] = await Promise.all([
    getSettings(),
    extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AUDIT_LOG),
    getEdition(),
  ]);
  const existing = (data[STORAGE_KEYS.AUDIT_LOG] as AuditEntry[] | undefined) ?? [];
  const cutoff = Date.now() - settings.auditRetentionDays * 24 * 60 * 60 * 1000;
  const next = [entry, ...existing]
    .filter((e) => e.timestamp > cutoff)
    .slice(0, getAuditLimit(edition));

  await extensionApi.storage.local.set({ [STORAGE_KEYS.AUDIT_LOG]: next });
}

export async function updateStatsFromResult(result: ClassificationResult): Promise<void> {
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

export async function setupOffscreen(): Promise<void> {
  if (!supportsOffscreen) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = (async () => {
    const contexts = await extensionApi.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'] as chrome.runtime.ContextType[],
    });
    if (contexts && contexts.length > 0) return;

    const offscreenReason = extensionApi.offscreen.Reason;
    if (!offscreenReason) return;

    try {
      await extensionApi.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [offscreenReason.DOM_PARSER],
        justification: 'Run local ONNX and WASM classification for proprietary code leak interception',
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

export async function getAICapability(): Promise<AICapabilityRecord> {
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AI_CAPABILITY);
  const stored = data[STORAGE_KEYS.AI_CAPABILITY] as AICapabilityRecord | undefined;
  return stored
    ? {
        ...DEFAULT_AI_CAPABILITY,
        ...stored,
        enhanced: { ...DEFAULT_AI_CAPABILITY.enhanced, ...stored.enhanced },
      }
    : { ...DEFAULT_AI_CAPABILITY };
}

export async function saveAICapability(capability: AICapabilityRecord): Promise<void> {
  await extensionApi.storage.local.set({ [STORAGE_KEYS.AI_CAPABILITY]: capability });
}

export async function probeOnnxState(): Promise<Pick<AICapabilityRecord, 'onnxReady' | 'onnxState'>> {
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

export async function probeEnhancedAI(tabId?: number): Promise<GeminiAvailability> {
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

export async function refreshAICapability(tabId?: number): Promise<AICapabilityRecord> {
  const [current, onnx] = await Promise.all([getAICapability(), probeOnnxState()]);
  const availability = await probeEnhancedAI(tabId);
  const next = mergeAICapability(current, {
    ...onnx,
    enhanced: enhancedFromGeminiAvailability(availability),
  });
  await saveAICapability(next);
  return next;
}

async function runOffscreenClassification(
  text: string,
  settings: SourceCloakSettings
): Promise<ClassificationResult | null> {
  await setupOffscreen();
  const response = await extensionApi.runtime.sendMessage<{
    success: boolean;
    result?: ClassificationResult;
    error?: string;
  }>({
    type: 'run-offscreen-classification',
    text,
    settings,
  });
  return response?.success && response.result ? response.result : null;
}

export async function classifyPayload(
  text: string,
  settings: SourceCloakSettings
): Promise<ClassificationResult> {
  if (supportsOffscreen && (settings.useOnnxClassifier || settings.useGeminiNano)) {
    try {
      const result = await runOffscreenClassification(text, settings);
      if (result) return result;
    } catch (err) {
      console.warn('[SourceCloak] Offscreen classification failed, retrying once...', err);
      try {
        resetOffscreenCreateLock();
        const result = await runOffscreenClassification(text, settings);
        if (result) return result;
      } catch (retryErr) {
        console.warn(
          '[SourceCloak] Offscreen classification failed after retry, using rules fallback:',
          retryErr
        );
      }
    }
  }

  return classifyWithRules(text, settings);
}

export { allowResult };
