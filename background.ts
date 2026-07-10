import { DEFAULT_SETTINGS, STORAGE_KEYS } from './src/constants';
import {
  getSettings,
  refreshAICapability,
  setupOffscreen,
  supportsOffscreen,
} from './src/bg-services';
import { handleRuntimeMessage } from './src/bg-handlers';
import { isExtensionSender } from './src/ipc';
import { isProUser } from './src/license-client';
import { extensionApi } from './src/platform';
import type { SourceCloakSettings } from './src/types';

extensionApi.runtime.onInstalled?.addListener(async (details) => {
  if (details.reason === 'install') {
    await extensionApi.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.STATS]: {
        totalScans: 0,
        totalBlocks: 0,
        blocksByCategory: {},
      },
      [STORAGE_KEYS.AUDIT_LOG]: [],
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

extensionApi.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  if (!isExtensionSender(sender)) return false;
  return handleRuntimeMessage(message, sender, sendResponse);
});
