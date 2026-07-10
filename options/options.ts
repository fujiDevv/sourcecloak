/**
 * Policy Console bootstrap — wires modular settings / license / audit / capability UIs.
 */
import { DEVICE_COMPATIBILITY_URL, STORAGE_KEYS } from '../src/constants';
import { wireFlagLinks } from '../src/gemini-status';
import { extensionApi } from '../src/platform';
import type { Edition } from '../src/types';
import { createAuditUi } from './audit-ui';
import { createCapabilityUi } from './capability-ui';
import { el } from './dom';
import { createLicenseUi } from './license-ui';
import { createSettingsUi } from './settings-ui';

const settingsUi = createSettingsUi();
const licenseUi = createLicenseUi();
const capabilityUi = createCapabilityUi();

function applyEdition(edition: Edition, customerEmail?: string): void {
  settingsUi.applyEditionChrome(edition);
  settingsUi.setEdition(edition);
  licenseUi.applyEdition(edition, customerEmail);
  capabilityUi.load().catch(console.error);
}

const auditUi = createAuditUi((edition) => applyEdition(edition));

async function loadSettings(): Promise<void> {
  const { edition, customerEmail } = await settingsUi.loadFromBackground();
  applyEdition(edition, customerEmail);
}

settingsUi.bind({
  onProTabBlocked: () => licenseUi.openHalo(),
  onAuditTab: () => {
    void auditUi.load();
  },
});

licenseUi.bind({
  onActivated: async (edition, customerEmail) => {
    applyEdition(edition, customerEmail);
    await loadSettings();
  },
  onDeactivated: async () => {
    applyEdition('community');
    await loadSettings();
  },
});

capabilityUi.bind();

const versionTag = el<HTMLSpanElement>('version-tag');
const compatibilityLink = el<HTMLAnchorElement>('compatibility-link');
const welcomeBanner = el<HTMLElement>('welcome-banner');
const welcomeDismiss = el<HTMLButtonElement>('welcome-dismiss');

versionTag.textContent = `v${extensionApi.runtime.getManifest()?.version ?? '1.0.0'}`;
compatibilityLink.href = DEVICE_COMPATIBILITY_URL;

welcomeDismiss.addEventListener('click', async () => {
  welcomeBanner.classList.add('hidden');
  await extensionApi.storage.local.set({ [STORAGE_KEYS.WELCOME_SEEN]: true });
});

async function maybeShowWelcomeBanner(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.WELCOME_SEEN);
  const seen = !!data[STORAGE_KEYS.WELCOME_SEEN];

  if (params.get('welcome') === '1' || params.get('compat') === '1' || !seen) {
    welcomeBanner.classList.remove('hidden');
  }
}

const params = new URLSearchParams(window.location.search);
if (params.get('welcome') === '1' || params.get('halo') === '1' || window.location.hash === '#upgrade') {
  licenseUi.openHalo();
}

if (params.get('compat') === '1') {
  capabilityUi.load(true).catch(console.error);
}

wireFlagLinks();

void loadSettings();
void auditUi.load();
void maybeShowWelcomeBanner().catch(console.error);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void loadSettings();
    void capabilityUi.load().catch(console.error);
  }
});
