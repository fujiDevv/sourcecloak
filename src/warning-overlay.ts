import type { ThreatMatch } from './types';

const OVERLAY_ID = 'sourcecloak-warning';
const STYLE_ID = 'sourcecloak-styles';

const OVERLAY_CSS = `
#${OVERLAY_ID} {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
}
#${OVERLAY_ID} * { box-sizing: border-box; }
#${OVERLAY_ID} .shield-panel {
  width: min(420px, calc(100vw - 32px));
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: #0a0a0a;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  color: #ffffff;
}
#${OVERLAY_ID} .shield-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 12px 24px;
}
#${OVERLAY_ID} .shield-icon {
  padding: 6px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  display: block;
  object-fit: contain;
}
#${OVERLAY_ID} .shield-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}
#${OVERLAY_ID} .shield-subtitle {
  font-size: 12px;
  color: #a3a3a3;
  margin: 4px 0 0 0;
}
#${OVERLAY_ID} .shield-body {
  padding: 0 24px 24px 24px;
}
#${OVERLAY_ID} .match-card {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: #000000;
  padding: 16px;
  font-size: 12px;
  font-family: "IBM Plex Mono", monospace;
  color: #a3a3a3;
  margin-bottom: 12px;
}
#${OVERLAY_ID} .match-card:last-child {
  margin-bottom: 0;
}
#${OVERLAY_ID} .match-title {
  color: #ffffff;
  margin-bottom: 8px;
}
#${OVERLAY_ID} .shield-footer {
  padding: 0 24px 24px 24px;
  display: flex;
  justify-content: flex-end;
}
#${OVERLAY_ID} button {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: #ffffff;
  color: #000000;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
#${OVERLAY_ID} button:hover {
  background: #e5e5e5;
}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = OVERLAY_CSS;
  document.documentElement.appendChild(style);
}

export function showBlockWarning(matches: ThreatMatch[], organizationName: string): void {
  ensureStyles();
  dismissBlockWarning();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'SourceCloak security warning');

  const matchItems = matches.slice(0, 3).map((match) => `
    <div class="match-card">
      <div class="match-title">${escapeHtml(match.label)}</div>
      <div>confidence: ${(match.confidence).toFixed(2)}</div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="shield-panel">
      <div class="shield-header">
        <img class="shield-icon" src="${chrome.runtime.getURL('assets/logo128.png')}" alt="SourceCloak" />
        <div>
          <h3 class="shield-title">Transmission Blocked</h3>
          <p class="shield-subtitle">SourceCloak intercepted this paste locally</p>
        </div>
      </div>
      <div class="shield-body">
        ${matchItems}
      </div>
      <div class="shield-footer">
        <button data-action="dismiss">Acknowledge</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.action === 'dismiss' || target === overlay) {
      dismissBlockWarning();
    }
  });

  document.documentElement.appendChild(overlay);
}

export function dismissBlockWarning(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}