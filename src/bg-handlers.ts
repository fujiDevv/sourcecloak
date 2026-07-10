import {
  enhancedFromGeminiAvailability,
  mergeAICapability,
  type AICapabilityRecord,
} from './ai-capability';
import {
  allowResult,
  appendAuditEntry,
  classifyPayload,
  getAICapability,
  getEdition,
  getSettings,
  getStats,
  probeOnnxState,
  refreshAICapability,
  saveAICapability,
  setupOffscreen,
  supportsOffscreen,
  updateStatsFromResult,
} from './bg-services';
import { STORAGE_KEYS } from './constants';
import { getAuditLimit } from './edition';
import {
  isContentScriptSender,
  isExtensionPageSender,
  isOffscreenSender,
} from './ipc';
import {
  activateProLicense,
  deactivateProLicense,
  getLicenseStatus,
  openProCheckoutPage,
} from './license-client';
import {
  dispatchMessage,
  replyErr,
  replyOk,
  type RouteTable,
} from './message-router';
import { extensionApi } from './platform';
import { isHostnameInScope } from './utils';
import type { AuditEntry, Edition, GeminiAvailability } from './types';

function isTrustedReader(sender: chrome.runtime.MessageSender): boolean {
  return isExtensionPageSender(sender) || isContentScriptSender(sender);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export const messageRoutes: RouteTable = {
  'get-settings': {
    allow: isTrustedReader,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      const [settings, edition] = await Promise.all([getSettings(), getEdition()]);
      replyOk(sendResponse, { settings, edition });
    },
  },

  'get-edition': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      replyOk(sendResponse, { edition: await getEdition() });
    },
  },

  'get-license-status': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      const status = await getLicenseStatus();
      replyOk(sendResponse, { ...status });
    },
  },

  'open-checkout-page': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      await openProCheckoutPage();
      replyOk(sendResponse);
    },
  },

  'activate-license': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (message, _sender, sendResponse) => {
      const licenseKey = asString(message.licenseKey);
      const status = await activateProLicense(licenseKey);
      if (!status.isPro) {
        replyErr(
          sendResponse,
          status.error ?? 'License activation failed. Check your key and try again.'
        );
        return;
      }
      replyOk(sendResponse, {
        edition: 'pro' as Edition,
        customerEmail: status.customerEmail,
      });
    },
  },

  'deactivate-license': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      await deactivateProLicense();
      replyOk(sendResponse, { edition: 'community' as Edition });
    },
  },

  'get-stats': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      replyOk(sendResponse, { stats: await getStats() });
    },
  },

  'get-audit-log': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      const [data, edition] = await Promise.all([
        extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.AUDIT_LOG),
        getEdition(),
      ]);
      const entries = (data[STORAGE_KEYS.AUDIT_LOG] as AuditEntry[] | undefined) ?? [];
      replyOk(sendResponse, {
        entries: entries.slice(0, getAuditLimit(edition)),
        edition,
      });
    },
  },

  'get-ai-capability': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      replyOk(sendResponse, { capability: await getAICapability() });
    },
  },

  'refresh-ai-capability': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      replyOk(sendResponse, { capability: await refreshAICapability() });
    },
  },

  'update-enhanced-ai-availability': {
    allow: isContentScriptSender,
    async: true,
    handle: async (message, _sender, sendResponse) => {
      const availability = message.availability as GeminiAvailability;
      const [current, onnx] = await Promise.all([getAICapability(), probeOnnxState()]);
      const next = mergeAICapability(current, {
        ...onnx,
        enhanced: enhancedFromGeminiAvailability(availability),
      });
      await saveAICapability(next);
      replyOk(sendResponse, { capability: next });
    },
  },

  'get-gemini-availability': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      try {
        const capability = await getAICapability();
        if (
          capability.enhanced.checkedAt > 0 &&
          capability.enhanced.geminiAvailability !== 'unknown'
        ) {
          replyOk(sendResponse, {
            availability: capability.enhanced.geminiAvailability,
            capability,
          });
          return;
        }

        const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
        if (
          !tab?.id ||
          tab.url?.startsWith('chrome://') ||
          tab.url?.startsWith('chrome-extension://')
        ) {
          replyOk(sendResponse, {
            availability: 'unavailable',
            tabRestricted: true,
            capability,
          });
          return;
        }

        const refreshed = await refreshAICapability(tab.id);
        replyOk(sendResponse, {
          availability: refreshed.enhanced.geminiAvailability,
          tabUrl: tab.url,
          capability: refreshed,
        });
      } catch {
        const capability = await getAICapability();
        replyOk(sendResponse, {
          availability: 'unavailable',
          tabRestricted: false,
          capability,
        });
      }
    },
  },

  'check-model-status': {
    allow: isExtensionPageSender,
    async: true,
    handle: async (_msg, _sender, sendResponse) => {
      if (!supportsOffscreen) {
        sendResponse({ success: true, state: 'unsupported', progress: 0 });
        return;
      }
      await setupOffscreen();
      const res = await extensionApi.runtime.sendMessage({ type: 'check-offscreen-model-status' });
      sendResponse(res);
    },
  },

  'update-model-progress': {
    allow: isOffscreenSender,
    async: false,
    handle: (message) => {
      void (async () => {
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
    },
  },

  'log-gemini-fallback': {
    allow: isOffscreenSender,
    async: false,
    handle: () => {
      void (async () => {
        const data = await extensionApi.storage.local.get<Record<string, unknown>>(
          STORAGE_KEYS.AI_FALLBACK_LOGGED
        );
        if (data[STORAGE_KEYS.AI_FALLBACK_LOGGED]) return;
        await extensionApi.storage.local.set({ [STORAGE_KEYS.AI_FALLBACK_LOGGED]: Date.now() });
      })().catch(() => {});
    },
  },

  'record-sync-block': {
    allow: isContentScriptSender,
    async: false,
    handle: (message) => {
      void updateStatsFromResult(message.result as Parameters<typeof updateStatsFromResult>[0]).catch(
        () => {}
      );
      void appendAuditEntry(message.entry as AuditEntry).catch(() => {});
    },
  },

  'classify-payload': {
    allow: isContentScriptSender,
    async: true,
    handle: async (message, _sender, sendResponse) => {
      const text = asString(message.text);
      const hostname = asString(message.hostname);
      const url = asString(message.url);
      const rawEvent = asString(message.eventType, 'paste');
      const eventType: AuditEntry['eventType'] = rawEvent === 'input' ? 'input' : 'paste';
      const elementTag = asString(message.elementTag, 'unknown');

      const settings = await getSettings();
      if (!settings.enabled || !isHostnameInScope(hostname, settings)) {
        replyOk(sendResponse, { result: allowResult() });
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
        elementTag,
      };

      await appendAuditEntry(entry);
      replyOk(sendResponse, { result });
    },
  },
};

export function handleRuntimeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  return dispatchMessage(messageRoutes, message, sender, sendResponse);
}
