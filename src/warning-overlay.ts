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
  backdrop-filter: blur(8px);
  font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
}
#${OVERLAY_ID} * { box-sizing: border-box; }
#${OVERLAY_ID} .shield-panel {
  width: min(520px, calc(100vw - 32px));
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: #0a0a0a;
  color: #ffffff;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
}
#${OVERLAY_ID} .shield-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 12px;
}
#${OVERLAY_ID} .shield-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 20px;
}
#${OVERLAY_ID} h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
}
#${OVERLAY_ID} .shield-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #a3a3a3;
}
#${OVERLAY_ID} .shield-body {
  padding: 12px 24px 20px;
}
#${OVERLAY_ID} .shield-alert {
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #e5e5e5;
}
#${OVERLAY_ID} .match-list {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
#${OVERLAY_ID} .match-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 13px;
}
#${OVERLAY_ID} .match-list li:last-child { border-bottom: none; }
#${OVERLAY_ID} .match-label { color: #ffffff; }
#${OVERLAY_ID} .match-confidence {
  color: #a3a3a3;
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .shield-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 24px;
}
#${OVERLAY_ID} button {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
#${OVERLAY_ID} .btn-primary {
  background: #ffffff;
  color: #000000;
}
#${OVERLAY_ID} .btn-primary:hover { background: #e5e5e5; }
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

  const matchItems = matches.slice(0, 5).map((match) => `
    <li>
      <span class="match-label">${escapeHtml(match.label)}</span>
      <span class="match-confidence">${Math.round(match.confidence * 100)}%</span>
    </li>
  `).join('');

  overlay.innerHTML = `
    <div class="shield-panel">
      <div class="shield-header">
        <div class="shield-icon">⛨</div>
        <div>
          <h2>Transmission Blocked</h2>
          <p class="shield-subtitle">SourceCloak · ${escapeHtml(organizationName)}</p>
        </div>
      </div>
      <div class="shield-body">
        <div class="shield-alert">
          Proprietary or sensitive material was intercepted before it could leave this device.
          The input field has been purged locally. No network request was made.
        </div>
        <ul class="match-list">${matchItems}</ul>
      </div>
      <div class="shield-footer">
        <button class="btn-primary" data-action="dismiss">Acknowledge</button>
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