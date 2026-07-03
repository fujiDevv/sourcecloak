import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../src/constants';
import { formatGeminiStatus, geminiFlagUrl, wireFlagLinks } from '../src/gemini-status';
import { extensionApi } from '../src/platform';
import type { AuditEntry, Edition, GeminiAvailability, SourceCloakSettings, SourceCloakStats } from '../src/types';

const enabledToggle = document.getElementById('toggle-enabled') as HTMLInputElement;
const statusPill = document.getElementById('status-pill') as HTMLSpanElement;
const classifierStatus = document.getElementById('classifier-status') as HTMLSpanElement;
const metricScans = document.getElementById('metric-scans') as HTMLElement;
const metricBlocks = document.getElementById('metric-blocks') as HTMLElement;
const recentList = document.getElementById('recent-list') as HTMLUListElement;
const openOptionsBtn = document.getElementById('open-options') as HTMLButtonElement;
const exploreProBtn = document.getElementById('explore-pro') as HTMLButtonElement;
const geminiStatusBlock = document.getElementById('gemini-status-block') as HTMLElement;
const geminiStatus = document.getElementById('gemini-status') as HTMLElement;
const geminiHint = document.getElementById('gemini-hint') as HTMLParagraphElement;

function setGeminiStatusVisible(visible: boolean): void {
  geminiStatusBlock.classList.toggle('hidden', !visible);
  if (!visible) {
    geminiHint.classList.add('hidden');
    geminiHint.textContent = '';
  }
}

function applyGeminiUi(availability: GeminiAvailability): void {
  const info = formatGeminiStatus(availability);
  geminiStatus.textContent = info.label;
  geminiStatus.className = `badge gemini-${info.availability}`;

  if (info.showFlagLink) {
    geminiHint.classList.remove('hidden');
    geminiHint.innerHTML = `${info.description} Enable <a href="${geminiFlagUrl()}" class="flag-link">Prompt API for Gemini Nano</a> in <code>chrome://flags</code>.`;
    wireFlagLinks();
  } else if (!info.ready && availability === 'downloading') {
    geminiHint.classList.remove('hidden');
    geminiHint.textContent = info.description;
  } else {
    geminiHint.classList.add('hidden');
    geminiHint.textContent = '';
  }
}

async function loadGeminiStatus(): Promise<void> {
  if (geminiStatusBlock.classList.contains('hidden')) return;

  applyGeminiUi('unknown');
  const res = await extensionApi.runtime.sendMessage<{
    success?: boolean;
    availability?: GeminiAvailability;
    tabRestricted?: boolean;
  }>({ type: 'get-gemini-availability' });

  if (res?.tabRestricted) {
    applyGeminiUi('unavailable');
    geminiHint.classList.remove('hidden');
    geminiHint.innerHTML = `Open a regular webpage tab to detect Gemini Nano. Then enable <a href="${geminiFlagUrl()}" class="flag-link">Prompt API for Gemini Nano</a> in <code>chrome://flags</code> if needed.`;
    wireFlagLinks();
    return;
  }

  applyGeminiUi(res?.availability ?? 'unavailable');
}

function applyEditionUi(edition: Edition): void {
  const isPro = edition === 'pro';
  exploreProBtn.classList.toggle('hidden', isPro);
  classifierStatus.textContent = isPro ? '4-Tier' : 'Tier 1–2';
  classifierStatus.className = `badge ${isPro ? 'ready' : 'ready'}`;
  setGeminiStatusVisible(isPro);
  if (isPro) loadGeminiStatus().catch(console.error);
}

async function loadDashboard(): Promise<void> {
  const [settingsRes, statsRes, auditRes, editionRes] = await Promise.all([
    extensionApi.runtime.sendMessage<{ success: boolean; settings: SourceCloakSettings; edition?: Edition }>({ type: 'get-settings' }),
    extensionApi.runtime.sendMessage<{ success: boolean; stats: SourceCloakStats }>({ type: 'get-stats' }),
    extensionApi.runtime.sendMessage<{ success: boolean; entries: AuditEntry[] }>({ type: 'get-audit-log' }),
    extensionApi.runtime.sendMessage<{ success: boolean; edition: Edition }>({ type: 'get-edition' }),
  ]);

  const edition = editionRes?.edition ?? settingsRes?.edition ?? 'community';
  applyEditionUi(edition);

  const settings = settingsRes?.settings ?? DEFAULT_SETTINGS;
  const stats = statsRes?.stats ?? { totalScans: 0, totalBlocks: 0, blocksByCategory: {} };
  const entries = (auditRes?.entries ?? []).filter((entry) => entry.blocked).slice(0, 5);

  enabledToggle.checked = settings.enabled;
  statusPill.textContent = settings.enabled ? 'Active' : 'Paused';
  statusPill.classList.toggle('active', settings.enabled);
  metricScans.textContent = String(stats.totalScans);
  metricBlocks.textContent = String(stats.totalBlocks);

  if (entries.length === 0) {
    recentList.innerHTML = '<li class="empty">No intercepts recorded yet.</li>';
    return;
  }

  recentList.innerHTML = entries.map((entry) => {
    const label = entry.matches[0]?.label ?? 'Sensitive payload';
    const time = new Date(entry.timestamp).toLocaleTimeString();
    return `<li class="blocked"><strong>${escapeHtml(entry.hostname)}</strong> · ${escapeHtml(label)} <span>${time}</span></li>`;
  }).join('');
}

enabledToggle.addEventListener('change', async () => {
  const current = await extensionApi.storage.local.get<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...(current[STORAGE_KEYS.SETTINGS] as Partial<SourceCloakSettings> | undefined) };
  settings.enabled = enabledToggle.checked;
  await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  await loadDashboard();
});

openOptionsBtn.addEventListener('click', () => {
  extensionApi.runtime.openOptionsPage();
});

exploreProBtn.addEventListener('click', async () => {
  const optionsUrl = extensionApi.runtime.getURL('options/options.html?halo=1');
  await extensionApi.tabs.create({ url: optionsUrl });
});

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

loadDashboard();