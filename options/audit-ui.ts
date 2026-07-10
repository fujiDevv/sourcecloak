import { extensionApi } from '../src/platform';
import type { AuditEntry, Edition } from '../src/types';
import { el, escapeHtml } from './dom';

export interface AuditUi {
  load: () => Promise<Edition | undefined>;
}

export function createAuditUi(onEdition?: (edition: Edition) => void): AuditUi {
  const auditBody = el<HTMLTableSectionElement>('audit-body');

  async function load(): Promise<Edition | undefined> {
    const response = await extensionApi.runtime.sendMessage<{
      success: boolean;
      entries: AuditEntry[];
      edition?: Edition;
    }>({ type: 'get-audit-log' });

    if (response?.edition) onEdition?.(response.edition);

    const entries = response?.entries ?? [];
    if (entries.length === 0) {
      auditBody.innerHTML = '<tr><td colspan="5" class="empty">No audit events yet.</td></tr>';
      return response?.edition;
    }

    auditBody.innerHTML = entries
      .map((entry) => {
        const match = entry.matches[0]?.label ?? '—';
        const result = entry.blocked ? 'BLOCKED' : 'Allowed';
        return `<tr>
      <td>${new Date(entry.timestamp).toLocaleString()}</td>
      <td>${escapeHtml(entry.hostname)}</td>
      <td>${escapeHtml(entry.eventType)}</td>
      <td>${result}</td>
      <td>${escapeHtml(match)}</td>
    </tr>`;
      })
      .join('');

    return response?.edition;
  }

  return { load };
}
