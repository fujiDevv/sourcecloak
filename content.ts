import { InputGuard } from './src/input-guard';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './src/constants';
import { setMainWorldPort } from './src/ai';
import type { AuditEntry, ClassificationResult, SourceCloakSettings } from './src/types';
import { extensionApi, getRuntimeUrl } from './src/platform';

let currentSettings: SourceCloakSettings = { ...DEFAULT_SETTINGS };
let inputGuard: InputGuard | null = null;
let isOrphaned = false;
let mainWorldInjected = false;

/** Inject only when Tier 4 (Gemini Nano) is enabled — avoids running page scripts on every site. */
function ensureMainWorldBridge(): void {
  if (mainWorldInjected || !currentSettings.useGeminiNano) return;

  try {
    if (!extensionApi.runtime.id) return;
    if (window !== window.top) return;
    if (document.documentElement.tagName.toLowerCase() !== 'html') return;

    mainWorldInjected = true;

    const channel = new MessageChannel();
    setMainWorldPort(channel.port1);

    const script = document.createElement('script');
    script.src = getRuntimeUrl('main_world.js');
    script.onload = () => {
      script.remove();
      window.postMessage({ type: 'SOURCECLOAK_AI_INIT_PORT' }, '*', [channel.port2]);
    };
    script.onerror = () => {
      mainWorldInjected = false;
      console.warn('[SourceCloak] Main world bridge script failed to load');
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    mainWorldInjected = false;
    console.warn('[SourceCloak] Main world bridge injection failed:', err);
  }
}

function checkContextOrCleanup(): boolean {
  if (isOrphaned) return false;
  if (!extensionApi.runtime.id) {
    cleanup();
    return false;
  }
  return true;
}

function cleanup(): void {
  if (isOrphaned) return;
  isOrphaned = true;
  inputGuard?.destroy();
  inputGuard = null;
  extensionApi.storage.onChanged?.removeListener(handleStorageChanged);
  extensionApi.runtime.onMessage?.removeListener(handleRuntimeMessage);
}

function safeSendMessage<T = unknown>(message: unknown): Promise<T | undefined> {
  if (!checkContextOrCleanup()) return Promise.resolve(undefined);
  return extensionApi.runtime.sendMessage<T>(message).catch((err: Error) => {
    if (err.message?.includes('context invalidated')) cleanup();
    return undefined;
  });
}

async function loadSettings(): Promise<void> {
  const response = await safeSendMessage<{ success?: boolean; settings?: SourceCloakSettings }>({ type: 'get-settings' });
  if (response?.settings) {
    currentSettings = { ...DEFAULT_SETTINGS, ...response.settings };
  }
}

function ensureGuard(): void {
  if (!checkContextOrCleanup()) return;

  if (!currentSettings.enabled) {
    inputGuard?.destroy();
    inputGuard = null;
    return;
  }

  if (!inputGuard) {
    inputGuard = new InputGuard({
      settings: currentSettings,
      onBlock: (result, element, eventType) => {
        safeSendMessage({
          type: 'record-sync-block',
          result,
          entry: buildAuditEntry(result, element, eventType)
        });
      }
    });
    inputGuard.start();
    return;
  }

  inputGuard.updateSettings(currentSettings);
}

function buildAuditEntry(
  result: ClassificationResult,
  element: Element,
  eventType: 'paste' | 'input'
): AuditEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    hostname: location.hostname,
    url: location.href,
    eventType,
    blocked: result.blocked,
    score: result.score,
    matches: result.matches,
    elementTag: element.tagName.toLowerCase()
  };
}

function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>): void {
  if (!checkContextOrCleanup()) return;
  if (!changes[STORAGE_KEYS.SETTINGS]) return;
  const next = changes[STORAGE_KEYS.SETTINGS].newValue as SourceCloakSettings | undefined;
  if (!next) return;
  currentSettings = { ...DEFAULT_SETTINGS, ...next };
  ensureMainWorldBridge();
  ensureGuard();
}

function handleRuntimeMessage(message: { type?: string }): boolean {
  if (!checkContextOrCleanup()) return false;
  if (message.type === 'settings-updated') {
    loadSettings().then(() => {
      ensureMainWorldBridge();
      ensureGuard();
    });
  }
  return false;
}

async function init(): Promise<void> {
  if (!checkContextOrCleanup()) return;
  await loadSettings();
  ensureMainWorldBridge();
  ensureGuard();
  extensionApi.storage.onChanged?.addListener(handleStorageChanged);
  extensionApi.runtime.onMessage?.addListener(handleRuntimeMessage);
}

if (document.documentElement.tagName.toLowerCase() === 'html') {
  init();
}