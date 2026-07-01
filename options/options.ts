import {
  COMMUNITY_MAX_SENSITIVITY,
  DEFAULT_SETTINGS,
  NO_REFUND_NOTICE,
  PRO_PRICE,
  STORAGE_KEYS,
} from '../src/constants';
import { sanitizeSettings } from '../src/edition';
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
const haloLogin = document.getElementById('halo-login') as HTMLButtonElement;
const haloStatus = document.getElementById('halo-status') as HTMLParagraphElement;
const haloPrice = document.getElementById('halo-price') as HTMLSpanElement;
const haloRefundNotice = document.getElementById('halo-refund-notice') as HTMLParagraphElement;

let currentEdition: Edition = 'community';

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
    useOnnxClassifier: (document.getElementById('use-onnx') as HTMLInputElement).checked,
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
  (document.getElementById('use-onnx') as HTMLInputElement).checked = settings.useOnnxClassifier;
  (document.getElementById('use-gemini') as HTMLInputElement).checked = settings.useGeminiNano;
  sensitivity.value = String(settings.sensitivity);
  sensitivityValue.textContent = String(settings.sensitivity);
  (document.getElementById('organization-name') as HTMLInputElement).value = settings.organizationName;
  (document.getElementById('custom-patterns') as HTMLTextAreaElement).value = arrayToLines(settings.customPatterns);
  (document.getElementById('corporate-signatures') as HTMLTextAreaElement).value = arrayToLines(settings.corporateSignatures);
  (document.getElementById('monitored-domains') as HTMLTextAreaElement).value = arrayToLines(settings.monitoredDomains);
  (document.getElementById('trusted-domains') as HTMLTextAreaElement).value = arrayToLines(settings.trustedDomains);
}

function applyEditionUi(edition: Edition): void {
  currentEdition = edition;
  const isPro = edition === 'pro';

  document.body.classList.toggle('edition-pro', isPro);
  document.body.classList.toggle('edition-community', !isPro);

  sensitivity.max = isPro ? '100' : String(COMMUNITY_MAX_SENSITIVITY);

  haloLogin.textContent = isPro ? 'Manage subscription' : 'Already paid? Log in';
  haloBuy.style.display = isPro ? 'none' : 'inline-flex';

  if (isPro) {
    closeHalo();
  }
}

function openHalo(): void {
  haloOverlay.classList.remove('hidden');
  haloOverlay.setAttribute('aria-hidden', 'false');
  haloStatus.textContent = '';
  haloStatus.classList.remove('error');
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
  const response = await extensionApi.runtime.sendMessage<{
    success: boolean;
    settings: SourceCloakSettings;
    edition?: Edition;
  }>({ type: 'get-settings' });

  const edition = response?.edition ?? 'community';
  const settings = sanitizeSettings(
    { ...DEFAULT_SETTINGS, ...(response?.settings ?? {}) },
    edition
  );

  applyEditionUi(edition);
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
      <td>${entry.eventType}</td>
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
    if (currentEdition === 'pro') return;
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

async function openPaymentFlow(type: 'open-payment-page' | 'open-login-page'): Promise<void> {
  const response = await extensionApi.runtime.sendMessage<{ success: boolean; error?: string }>({ type });
  if (!response?.success) {
    haloStatus.textContent = response?.error ?? 'Could not open payment page.';
    haloStatus.classList.add('error');
    return;
  }
  haloStatus.textContent = type === 'open-payment-page'
    ? 'Payment page opened. Pro unlocks automatically after checkout.'
    : 'Login page opened. Check your email for the magic link.';
  haloStatus.classList.remove('error');
}

haloBuy.addEventListener('click', () => openPaymentFlow('open-payment-page'));
haloLogin.addEventListener('click', () => openPaymentFlow('open-login-page'));

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

haloPrice.textContent = `$${PRO_PRICE}`;
haloRefundNotice.textContent = NO_REFUND_NOTICE;
versionTag.textContent = `v${extensionApi.runtime.getManifest()?.version ?? '1.0.0'}`;

const params = new URLSearchParams(window.location.search);
if (params.get('welcome') === '1' || params.get('halo') === '1' || window.location.hash === '#upgrade') {
  openHalo();
}

loadSettings();
loadAudit();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadSettings();
  }
});