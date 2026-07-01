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
  background: rgba(8, 12, 22, 0.72);
  backdrop-filter: blur(6px);
  font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
}
#${OVERLAY_ID} * { box-sizing: border-box; }
#${OVERLAY_ID} .shield-panel {
  width: min(520px, calc(100vw - 32px));
  border-radius: 14px;
  border: 1px solid rgba(255, 92, 92, 0.35);
  background: linear-gradient(180deg, #111827 0%, #0b1220 100%);
  color: #e5e7eb;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
#${OVERLAY_ID} .shield-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 22px 12px;
}
#${OVERLAY_ID} .shield-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  font-size: 20px;
}
#${OVERLAY_ID} h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #f9fafb;
}
#${OVERLAY_ID} .shield-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #9ca3af;
}
#${OVERLAY_ID} .shield-body {
  padding: 8px 22px 18px;
}
#${OVERLAY_ID} .shield-alert {
  border: 1px solid rgba(248, 113, 113, 0.25);
  background: rgba(127, 29, 29, 0.22);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: #fecaca;
}
#${OVERLAY_ID} .match-list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
#${OVERLAY_ID} .match-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  font-size: 12px;
}
#${OVERLAY_ID} .match-list li:last-child { border-bottom: none; }
#${OVERLAY_ID} .match-label { color: #e2e8f0; }
#${OVERLAY_ID} .match-confidence {
  color: #fca5a5;
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .shield-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}
#${OVERLAY_ID} button {
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
#${OVERLAY_ID} .btn-primary {
  background: #ef4444;
  color: #fff;
}
#${OVERLAY_ID} .btn-primary:hover { background: #dc2626; }
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