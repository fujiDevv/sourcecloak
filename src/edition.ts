import {
  COMMUNITY_MAX_AUDIT_ENTRIES,
  COMMUNITY_MAX_SENSITIVITY,
  MAX_AUDIT_ENTRIES,
} from './constants';
import type { Edition } from './types';
import { COMMUNITY_AI_CHAT_DOMAINS } from './presets';
import type { SourceCloakSettings } from './types';

export type { Edition };

export function isProEdition(edition: Edition): boolean {
  return edition === 'pro';
}

export function editionFromPaid(isPaid: boolean): Edition {
  return isPaid ? 'pro' : 'community';
}

export function getAuditLimit(edition: Edition): number {
  return edition === 'pro' ? MAX_AUDIT_ENTRIES : COMMUNITY_MAX_AUDIT_ENTRIES;
}

export function sanitizeSettings(settings: SourceCloakSettings, edition: Edition): SourceCloakSettings {
  if (edition === 'pro') {
    return {
      ...settings,
      sensitivity: Math.min(100, Math.max(0, settings.sensitivity)),
    };
  }

  return {
    ...settings,
    useOnnxClassifier: false,
    useGeminiNano: false,
    customPatterns: [],
    corporateSignatures: [],
    trustedDomains: [],
    monitoredDomains: [...COMMUNITY_AI_CHAT_DOMAINS],
    sensitivity: Math.min(COMMUNITY_MAX_SENSITIVITY, Math.max(0, settings.sensitivity)),
    auditRetentionDays: Math.min(settings.auditRetentionDays, 30),
  };
}