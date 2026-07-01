import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../src/constants';
import { extensionApi } from '../src/platform';
import type { AuditEntry, ShieldSettings, ShieldStats } from '../src/types';

const enabledToggle = document.getElementById('toggle-enabled') as HTMLInputElement;
const statusPill = document.getElementById('status-pill') as HTMLSpanElement;
const metricScans = document.getElementById('metric-scans') as HTMLElement;
const metricBlocks = document.getElementById('metric-blocks') as HTMLElement;
const modelStatus = document.getElementById('model-status') as HTMLSpanElement;
const nanoStatus = document.getElementById('nano-status') as HTMLSpanElement;
const recentList = document.getElementById('recent-list') as HTMLUListElement;
const openOptionsBtn = document.getElementById('open-options') as HTMLButtonElement;

async function loadDashboard(): Promise<void> {
  const [settingsRes, statsRes, auditRes, modelRes] = await Promise.all([
    extensionApi.runtime.sendMessage<{ success: boolean; settings: ShieldSettings }>({ type: 'get-settings' }),
    extensionApi.runtime.sendMessage<{ success: boolean; stats: ShieldStats }>({ type: 'get-stats' }),
    extensionApi.runtime.sendMessage<{ success: boolean; entries: AuditEntry[] }>({ type: 'get-audit-log' }),
    extensionApi.runtime.sendMessage<{ success: boolean; state: string; progress: number }>({ type: 'check-model-status' })
  ]);

  const settings = settingsRes?.settings ?? DEFAULT_SETTINGS;
  const stats = statsRes?.stats ?? { totalScans: 0, totalBlocks: 0, blocksByCategory: {} };
  const entries = (auditRes?.entries ?? []).filter((entry) => entry.blocked).slice(0, 5);

  enabledToggle.checked = settings.enabled;
  statusPill.textContent = settings.enabled ? 'Active' : 'Paused';
  statusPill.classList.toggle('active', settings.enabled);
  metricScans.textContent = String(stats.totalScans);
  metricBlocks.textContent = String(stats.totalBlocks);

  const state = modelRes?.state ?? 'idle';
  modelStatus.textContent = state === 'ready' ? 'Ready' : state === 'loading' ? `Loading ${modelRes?.progress ?? 0}%` : state;
  modelStatus.className = `badge ${state === 'ready' ? 'ready' : state === 'loading' ? 'loading' : ''}`;

  nanoStatus.textContent = settings.useGeminiNano ? 'Enabled' : 'Disabled';
  nanoStatus.className = `badge ${settings.useGeminiNano ? 'ready' : ''}`;

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
  const settings = { ...DEFAULT_SETTINGS, ...(current[STORAGE_KEYS.SETTINGS] as Partial<ShieldSettings> | undefined) };
  settings.enabled = enabledToggle.checked;
  await extensionApi.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  await loadDashboard();
});

openOptionsBtn.addEventListener('click', () => {
  extensionApi.runtime.openOptionsPage();
});

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

loadDashboard();