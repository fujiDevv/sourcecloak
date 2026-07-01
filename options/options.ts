import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../src/constants';
import { extensionApi } from '../src/platform';
import type { AuditEntry, SourceCloakSettings } from '../src/types';

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-btn'));
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
    auditRetentionDays: DEFAULT_SETTINGS.auditRetentionDays
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

async function loadSettings(): Promise<void> {
  const response = await extensionApi.runtime.sendMessage<{ success: boolean; settings: SourceCloakSettings }>({ type: 'get-settings' });
  applyForm({ ...DEFAULT_SETTINGS, ...(response?.settings ?? {}) });
}

async function loadAudit(): Promise<void> {
  const response = await extensionApi.runtime.sendMessage<{ success: boolean; entries: AuditEntry[] }>({ type: 'get-audit-log' });
  const entries = response?.entries ?? [];

  if (entries.length === 0) {
    auditBody.innerHTML = '<tr><td colspan="5" class="empty">No audit events yet.</td></tr>';
    return;
  }

  auditBody.innerHTML = entries.slice(0, 100).map((entry) => {
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
    tabs.forEach((btn) => btn.classList.toggle('active', btn === button));
    tabSections.forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${button.dataset.tab}`);
    });
    if (button.dataset.tab === 'audit') loadAudit();
  });
});

sensitivity.addEventListener('input', () => {
  sensitivityValue.textContent = sensitivity.value;
});

saveBtn.addEventListener('click', async () => {
  const settings = readForm();
  await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  saveStatus.textContent = 'Policy saved locally.';
  setTimeout(() => { saveStatus.textContent = ''; }, 2500);
});

exportBtn.addEventListener('click', () => {
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
  importFile.click();
});

importFile.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        applyForm({ ...DEFAULT_SETTINGS, ...parsed });
        await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: readForm() });
        saveStatus.textContent = 'Policy imported successfully!';
      } else {
        throw new Error('Invalid format');
      }
    } catch (err) {
      saveStatus.textContent = 'Error parsing policy file.';
    }
    setTimeout(() => { saveStatus.textContent = ''; }, 2500);
    // Reset file input so the same file can be imported again if needed
    importFile.value = '';
  };
  reader.readAsText(file);
});

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

versionTag.textContent = `v${extensionApi.runtime.getManifest()?.version ?? '1.0.0'}`;
loadSettings();
loadAudit();