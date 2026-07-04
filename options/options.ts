import {
  COMMUNITY_MAX_SENSITIVITY,
  DEFAULT_SETTINGS,
  DEVICE_COMPATIBILITY_URL,
  PRO_PRICE,
  NO_REFUND_NOTICE,
  STORAGE_KEYS,
} from '../src/constants';
import type { AICapabilityRecord } from '../src/ai-capability';
import { sanitizeSettings } from '../src/edition';
import { formatLocalAIStatus, geminiFlagUrl, wireFlagLinks } from '../src/gemini-status';
import { extensionApi } from '../src/platform';
import type { AuditEntry, Edition, SourceCloakSettings } from '../src/types';

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-tab]'));
const tabSections = Array.from(document.querySelectorAll<HTMLElement>('.tab'));
const saveBtn = document.getElementById('save-settings') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;
const sensitivity = document.getElementById('sensitivity') as HTMLInputElement;
const sensitivityValue = document.getElementById('sensitivity-value') as HTMLOutputElement;
const auditBody = document.getElementById('audit-body') as HTMLTableSectionElement;
const versionTag = document.getElementById('version-tag') as HTMLSpanElement;
const exportBtn = document.getElementById('export-policy') as HTMLButtonElement;
const importBtn = document.getElementById('import-policy') as HTMLButtonElement;
const importFile = document.getElementById('import-file') as HTMLInputElement;

const haloOverlay = document.getElementById('halo-overlay') as HTMLDivElement;
const haloClose = document.getElementById('halo-close') as HTMLButtonElement;
const haloBuy = document.getElementById('halo-buy') as HTMLButtonElement;
const haloStatus = document.getElementById('halo-status') as HTMLParagraphElement;
const haloPrice = document.getElementById('halo-price') as HTMLSpanElement;
const haloRefundNotice = document.getElementById('halo-refund-notice') as HTMLParagraphElement;
const haloLicenseSection = document.getElementById('halo-license-section') as HTMLDivElement;
const haloLicenseKey = document.getElementById('halo-license-key') as HTMLInputElement;
const haloActivate = document.getElementById('halo-activate') as HTMLButtonElement;
const haloProSection = document.getElementById('halo-pro-section') as HTMLDivElement;
const haloProEmail = document.getElementById('halo-pro-email') as HTMLParagraphElement;
const haloDeactivate = document.getElementById('halo-deactivate') as HTMLButtonElement;

let currentEdition: Edition = 'community';

const welcomeBanner = document.getElementById('welcome-banner') as HTMLElement;
const welcomeDismiss = document.getElementById('welcome-dismiss') as HTMLButtonElement;
const aiCapabilityBanner = document.getElementById('ai-capability-banner') as HTMLElement;
const aiCapabilityLabel = document.getElementById('ai-capability-label') as HTMLHeadingElement;
const aiCapabilityTier = document.getElementById('ai-capability-tier') as HTMLSpanElement;
const aiCapabilityDesc = document.getElementById('ai-capability-desc') as HTMLParagraphElement;
const refreshAICapabilityBtn = document.getElementById('refresh-ai-capability') as HTMLButtonElement;
const compatibilityLink = document.getElementById('compatibility-link') as HTMLAnchorElement;

function applyCapabilityUi(capability: AICapabilityRecord): void {
  const info = formatLocalAIStatus(capability);
  aiCapabilityBanner.classList.remove('ai-banner-enhanced', 'ai-banner-optimized', 'ai-banner-fallback');
  aiCapabilityBanner.classList.add(`ai-banner-${info.tier}`);
  aiCapabilityLabel.textContent = info.label;
  aiCapabilityTier.textContent = info.tier === 'enhanced' ? 'Gemini Nano' : 'ONNX';
  aiCapabilityTier.className = `status-pill ai-tier-${info.tier}`;

  if (info.showFlagLink) {
    aiCapabilityDesc.innerHTML = `${info.description} Enable <a href="${geminiFlagUrl()}" class="flag-link">Prompt API for Gemini Nano</a> in <code>chrome://flags</code> for Tier 4.`;
    wireFlagLinks(aiCapabilityBanner);
  } else {
    aiCapabilityDesc.textContent = info.description;
  }
}

async function loadAICapability(forceRefresh = false): Promise<void> {
  const type = forceRefresh ? 'refresh-ai-capability' : 'get-ai-capability';
  const res = await extensionApi.runtime.sendMessage<{
    success?: boolean;
    capability?: AICapabilityRecord;
  }>({ type });

  if (res?.capability) {
    applyCapabilityUi(res.capability);
  }
}

async function maybeShowWelcomeBanner(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const data = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.WELCOME_SEEN);
  const seen = !!data[STORAGE_KEYS.WELCOME_SEEN];

  if (params.get('welcome') === '1' || params.get('compat') === '1' || !seen) {
    welcomeBanner.classList.remove('hidden');
  }
}

function linesToArray(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function arrayToLines(values: string[]): string {
  return values.join('\n');
}

function readForm(): SourceCloakSettings {
  return {
    enabled: (document.getElementById('enabled') as HTMLInputElement).checked,
    blockPaste: (document.getElementById('block-paste') as HTMLInputElement).checked,
    blockInput: (document.getElementById('block-input') as HTMLInputElement).checked,
    showWarningOverlay: (document.getElementById('show-warning') as HTMLInputElement).checked,
    useOnnxClassifier: true,
    useGeminiNano: (document.getElementById('use-gemini') as HTMLInputElement).checked,
    sensitivity: Number(sensitivity.value),
    organizationName: (document.getElementById('organization-name') as HTMLInputElement).value.trim() || DEFAULT_SETTINGS.organizationName,
    customPatterns: linesToArray((document.getElementById('custom-patterns') as HTMLTextAreaElement).value),
    corporateSignatures: linesToArray((document.getElementById('corporate-signatures') as HTMLTextAreaElement).value),
    monitoredDomains: linesToArray((document.getElementById('monitored-domains') as HTMLTextAreaElement).value),
    trustedDomains: linesToArray((document.getElementById('trusted-domains') as HTMLTextAreaElement).value),
    auditRetentionDays: DEFAULT_SETTINGS.auditRetentionDays,
  };
}

function applyForm(settings: SourceCloakSettings): void {
  (document.getElementById('enabled') as HTMLInputElement).checked = settings.enabled;
  (document.getElementById('block-paste') as HTMLInputElement).checked = settings.blockPaste;
  (document.getElementById('block-input') as HTMLInputElement).checked = settings.blockInput;
  (document.getElementById('show-warning') as HTMLInputElement).checked = settings.showWarningOverlay;
  (document.getElementById('use-onnx') as HTMLInputElement).checked = true;
  (document.getElementById('use-gemini') as HTMLInputElement).checked = settings.useGeminiNano;
  sensitivity.value = String(settings.sensitivity);
  sensitivityValue.textContent = String(settings.sensitivity);
  (document.getElementById('organization-name') as HTMLInputElement).value = settings.organizationName;
  (document.getElementById('custom-patterns') as HTMLTextAreaElement).value = arrayToLines(settings.customPatterns);
  (document.getElementById('corporate-signatures') as HTMLTextAreaElement).value = arrayToLines(settings.corporateSignatures);
  (document.getElementById('monitored-domains') as HTMLTextAreaElement).value = arrayToLines(settings.monitoredDomains);
  (document.getElementById('trusted-domains') as HTMLTextAreaElement).value = arrayToLines(settings.trustedDomains);
}

function setHaloStatus(message: string, isError = false): void {
  haloStatus.textContent = message;
  haloStatus.classList.toggle('error', isError);
}

function applyEditionUi(edition: Edition, customerEmail?: string): void {
  currentEdition = edition;
  const isPro = edition === 'pro';

  document.body.classList.toggle('edition-pro', isPro);
  document.body.classList.toggle('edition-community', !isPro);

  sensitivity.max = isPro ? '100' : String(COMMUNITY_MAX_SENSITIVITY);

  haloBuy.style.display = isPro ? 'none' : 'inline-flex';
  haloLicenseSection.classList.toggle('hidden', isPro);
  haloProSection.classList.toggle('hidden', !isPro);

  if (isPro) {
    haloProEmail.textContent = customerEmail
      ? `Pro active for ${customerEmail}`
      : 'Pro license active on this device.';
  } else {
    haloProEmail.textContent = '';
  }

  loadAICapability().catch(console.error);
}

function openHalo(): void {
  haloOverlay.classList.remove('hidden');
  haloOverlay.setAttribute('aria-hidden', 'false');
  setHaloStatus('');
}

function closeHalo(): void {
  haloOverlay.classList.add('hidden');
  haloOverlay.setAttribute('aria-hidden', 'true');
}

function switchToTab(tabName: string): void {
  const isProTab = ['signatures', 'domains', 'deployment'].includes(tabName);
  if (isProTab && currentEdition !== 'pro') {
    openHalo();
    return;
  }

  tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
  tabSections.forEach((section) => {
    section.classList.toggle('active', section.id === `tab-${tabName}`);
  });
  if (tabName === 'audit') loadAudit();
}

async function loadSettings(): Promise<void> {
  const [settingsRes, licenseRes] = await Promise.all([
    extensionApi.runtime.sendMessage<{
      success: boolean;
      settings: SourceCloakSettings;
      edition?: Edition;
    }>({ type: 'get-settings' }),
    extensionApi.runtime.sendMessage<{
      success: boolean;
      isPro?: boolean;
      customerEmail?: string;
    }>({ type: 'get-license-status' }),
  ]);

  const edition = settingsRes?.edition ?? (licenseRes?.isPro ? 'pro' : 'community');
  const settings = sanitizeSettings(
    { ...DEFAULT_SETTINGS, ...(settingsRes?.settings ?? {}) },
    edition
  );

  applyEditionUi(edition, licenseRes?.customerEmail);
  applyForm(settings);
}

async function loadAudit(): Promise<void> {
  const response = await extensionApi.runtime.sendMessage<{
    success: boolean;
    entries: AuditEntry[];
    edition?: Edition;
  }>({ type: 'get-audit-log' });

  if (response?.edition) applyEditionUi(response.edition);

  const entries = response?.entries ?? [];
  if (entries.length === 0) {
    auditBody.innerHTML = '<tr><td colspan="5" class="empty">No audit events yet.</td></tr>';
    return;
  }

  auditBody.innerHTML = entries.map((entry) => {
    const match = entry.matches[0]?.label ?? '—';
    const result = entry.blocked ? 'BLOCKED' : 'Allowed';
    return `<tr>
      <td>${new Date(entry.timestamp).toLocaleString()}</td>
      <td>${escapeHtml(entry.hostname)}</td>
      <td>${escapeHtml(entry.eventType)}</td>
      <td>${result}</td>
      <td>${escapeHtml(match)}</td>
    </tr>`;
  }).join('');
}

tabs.forEach((button) => {
  button.addEventListener('click', () => {
    switchToTab(button.dataset.tab ?? 'policy');
  });
});

document.querySelectorAll<HTMLElement>('[data-open-halo]').forEach((el) => {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    openHalo();
  });
});

haloClose.addEventListener('click', closeHalo);
haloOverlay.addEventListener('click', (event) => {
  if (event.target === haloOverlay) closeHalo();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !haloOverlay.classList.contains('hidden')) {
    closeHalo();
  }
});

sensitivity.addEventListener('input', () => {
  sensitivityValue.textContent = sensitivity.value;
});

saveBtn.addEventListener('click', async () => {
  const settings = sanitizeSettings(readForm(), currentEdition);
  await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  applyForm(settings);
  saveStatus.textContent = 'Policy saved locally.';
  saveStatus.classList.remove('error');
  setTimeout(() => { saveStatus.textContent = ''; }, 2500);
});

exportBtn.addEventListener('click', () => {
  if (currentEdition !== 'pro') return;
  const settings = readForm();
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sourcecloak-policy-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => {
  if (currentEdition !== 'pro') return;
  importFile.click();
});

importFile.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || currentEdition !== 'pro') return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        const settings = sanitizeSettings({ ...DEFAULT_SETTINGS, ...parsed }, currentEdition);
        applyForm(settings);
        await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
        saveStatus.textContent = 'Policy imported successfully!';
        saveStatus.classList.remove('error');
      } else {
        throw new Error('Invalid format');
      }
    } catch {
      saveStatus.textContent = 'Error parsing policy file.';
      saveStatus.classList.add('error');
    }
    setTimeout(() => { saveStatus.textContent = ''; }, 2500);
    importFile.value = '';
  };
  reader.readAsText(file);
});

haloBuy.addEventListener('click', async () => {
  const response = await extensionApi.runtime.sendMessage<{ success: boolean; error?: string }>({
    type: 'open-checkout-page',
  });

  if (!response?.success) {
    setHaloStatus(response?.error ?? 'Could not open checkout page.', true);
    return;
  }

  setHaloStatus('Checkout opened. Paste your license key here after purchase.');
});

haloActivate.addEventListener('click', async () => {
  const licenseKey = haloLicenseKey.value.trim();
  if (!licenseKey) {
    setHaloStatus('Enter the license key from your purchase email.', true);
    return;
  }

  haloActivate.disabled = true;
  setHaloStatus('Activating license…');

  const response = await extensionApi.runtime.sendMessage<{
    success: boolean;
    edition?: Edition;
    customerEmail?: string;
    error?: string;
  }>({
    type: 'activate-license',
    licenseKey,
  });

  haloActivate.disabled = false;

  if (!response?.success) {
    setHaloStatus(response?.error ?? 'Activation failed.', true);
    return;
  }

  haloLicenseKey.value = '';
  applyEditionUi(response.edition ?? 'pro', response.customerEmail);
  await loadSettings();
  setHaloStatus('Pro unlocked. All features are now active.');
});

haloDeactivate.addEventListener('click', async () => {
  if (!confirm('Deactivate Pro on this device? You can re-activate with the same license key later.')) {
    return;
  }

  const response = await extensionApi.runtime.sendMessage<{ success: boolean; edition?: Edition; error?: string }>({
    type: 'deactivate-license',
  });

  if (!response?.success) {
    setHaloStatus(response?.error ?? 'Could not deactivate license.', true);
    return;
  }

  applyEditionUi('community');
  await loadSettings();
  setHaloStatus('License deactivated on this device.');
});

haloLicenseKey.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    haloActivate.click();
  }
});

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

haloPrice.textContent = `$${PRO_PRICE}`;
haloRefundNotice.textContent = NO_REFUND_NOTICE;
versionTag.textContent = `v${extensionApi.runtime.getManifest()?.version ?? '1.0.0'}`;
compatibilityLink.href = DEVICE_COMPATIBILITY_URL;

welcomeDismiss.addEventListener('click', async () => {
  welcomeBanner.classList.add('hidden');
  await extensionApi.storage.local.set({ [STORAGE_KEYS.WELCOME_SEEN]: true });
});

refreshAICapabilityBtn.addEventListener('click', async () => {
  refreshAICapabilityBtn.disabled = true;
  await loadAICapability(true);
  refreshAICapabilityBtn.disabled = false;
});

extensionApi.storage.onChanged?.addListener((changes) => {
  if (changes[STORAGE_KEYS.AI_CAPABILITY]) {
    const capability = changes[STORAGE_KEYS.AI_CAPABILITY].newValue as AICapabilityRecord | undefined;
    if (capability) applyCapabilityUi(capability);
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get('welcome') === '1' || params.get('halo') === '1' || window.location.hash === '#upgrade') {
  openHalo();
}

if (params.get('compat') === '1') {
  loadAICapability(true).catch(console.error);
}

wireFlagLinks();

loadSettings();
loadAudit();
maybeShowWelcomeBanner().catch(console.error);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadSettings();
    loadAICapability().catch(console.error);
  }
});