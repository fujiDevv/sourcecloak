import {
  COMMUNITY_MAX_SENSITIVITY,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from '../src/constants';
import { sanitizeSettings } from '../src/edition';
import { extensionApi } from '../src/platform';
import type { Edition, SourceCloakSettings } from '../src/types';
import { arrayToLines, el, linesToArray } from './dom';

export interface SettingsUi {
  readForm: () => SourceCloakSettings;
  applyForm: (settings: SourceCloakSettings) => void;
  applyEditionChrome: (edition: Edition) => void;
  getEdition: () => Edition;
  setEdition: (edition: Edition) => void;
  bind: (hooks: {
    onProTabBlocked: () => void;
    onAuditTab: () => void;
  }) => void;
  loadFromBackground: () => Promise<{ edition: Edition; customerEmail?: string }>;
}

export function createSettingsUi(): SettingsUi {
  const sensitivity = el<HTMLInputElement>('sensitivity');
  const sensitivityValue = el<HTMLOutputElement>('sensitivity-value');
  const saveBtn = el<HTMLButtonElement>('save-settings');
  const saveStatus = el<HTMLSpanElement>('save-status');
  const exportBtn = el<HTMLButtonElement>('export-policy');
  const importBtn = el<HTMLButtonElement>('import-policy');
  const importFile = el<HTMLInputElement>('import-file');
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-tab]'));
  const tabSections = Array.from(document.querySelectorAll<HTMLElement>('.tab'));

  let currentEdition: Edition = 'community';

  function readForm(): SourceCloakSettings {
    return {
      enabled: el<HTMLInputElement>('enabled').checked,
      blockPaste: el<HTMLInputElement>('block-paste').checked,
      blockInput: el<HTMLInputElement>('block-input').checked,
      showWarningOverlay: el<HTMLInputElement>('show-warning').checked,
      useOnnxClassifier: true,
      useGeminiNano: el<HTMLInputElement>('use-gemini').checked,
      sensitivity: Number(sensitivity.value),
      organizationName:
        el<HTMLInputElement>('organization-name').value.trim() || DEFAULT_SETTINGS.organizationName,
      customPatterns: linesToArray(el<HTMLTextAreaElement>('custom-patterns').value),
      corporateSignatures: linesToArray(el<HTMLTextAreaElement>('corporate-signatures').value),
      monitoredDomains: linesToArray(el<HTMLTextAreaElement>('monitored-domains').value),
      trustedDomains: linesToArray(el<HTMLTextAreaElement>('trusted-domains').value),
      auditRetentionDays: DEFAULT_SETTINGS.auditRetentionDays,
    };
  }

  function applyForm(settings: SourceCloakSettings): void {
    el<HTMLInputElement>('enabled').checked = settings.enabled;
    el<HTMLInputElement>('block-paste').checked = settings.blockPaste;
    el<HTMLInputElement>('block-input').checked = settings.blockInput;
    el<HTMLInputElement>('show-warning').checked = settings.showWarningOverlay;
    el<HTMLInputElement>('use-onnx').checked = true;
    el<HTMLInputElement>('use-gemini').checked = settings.useGeminiNano;
    sensitivity.value = String(settings.sensitivity);
    sensitivityValue.textContent = String(settings.sensitivity);
    el<HTMLInputElement>('organization-name').value = settings.organizationName;
    el<HTMLTextAreaElement>('custom-patterns').value = arrayToLines(settings.customPatterns);
    el<HTMLTextAreaElement>('corporate-signatures').value = arrayToLines(settings.corporateSignatures);
    el<HTMLTextAreaElement>('monitored-domains').value = arrayToLines(settings.monitoredDomains);
    el<HTMLTextAreaElement>('trusted-domains').value = arrayToLines(settings.trustedDomains);
  }

  function applyEditionChrome(edition: Edition): void {
    currentEdition = edition;
    const isPro = edition === 'pro';
    document.body.classList.toggle('edition-pro', isPro);
    document.body.classList.toggle('edition-community', !isPro);
    sensitivity.max = isPro ? '100' : String(COMMUNITY_MAX_SENSITIVITY);
  }

  function switchToTab(
    tabName: string,
    hooks: { onProTabBlocked: () => void; onAuditTab: () => void }
  ): void {
    const isProTab = ['signatures', 'domains', 'deployment'].includes(tabName);
    if (isProTab && currentEdition !== 'pro') {
      hooks.onProTabBlocked();
      return;
    }

    tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
    tabSections.forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${tabName}`);
    });
    if (tabName === 'audit') hooks.onAuditTab();
  }

  function flashStatus(message: string, isError = false): void {
    saveStatus.textContent = message;
    saveStatus.classList.toggle('error', isError);
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2500);
  }

  function bind(hooks: { onProTabBlocked: () => void; onAuditTab: () => void }): void {
    tabs.forEach((button) => {
      button.addEventListener('click', () => {
        switchToTab(button.dataset.tab ?? 'policy', hooks);
      });
    });

    sensitivity.addEventListener('input', () => {
      sensitivityValue.textContent = sensitivity.value;
    });

    saveBtn.addEventListener('click', async () => {
      const settings = sanitizeSettings(readForm(), currentEdition);
      await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      applyForm(settings);
      flashStatus('Policy saved locally.');
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
          const parsed = JSON.parse(content) as unknown;
          if (typeof parsed === 'object' && parsed !== null) {
            const settings = sanitizeSettings(
              { ...DEFAULT_SETTINGS, ...(parsed as Partial<SourceCloakSettings>) },
              currentEdition
            );
            applyForm(settings);
            await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
            flashStatus('Policy imported successfully!');
          } else {
            throw new Error('Invalid format');
          }
        } catch {
          flashStatus('Error parsing policy file.', true);
        }
        importFile.value = '';
      };
      reader.readAsText(file);
    });
  }

  async function loadFromBackground(): Promise<{ edition: Edition; customerEmail?: string }> {
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

    applyEditionChrome(edition);
    applyForm(settings);
    return { edition, customerEmail: licenseRes?.customerEmail };
  }

  return {
    readForm,
    applyForm,
    applyEditionChrome,
    getEdition: () => currentEdition,
    setEdition: (edition) => {
      currentEdition = edition;
    },
    bind,
    loadFromBackground,
  };
}
