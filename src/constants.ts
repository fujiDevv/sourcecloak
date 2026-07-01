import { COMMUNITY_AI_CHAT_DOMAINS } from './presets';

export const STORAGE_KEYS = {
  SETTINGS: 'sourcecloak-settings',
  AUDIT_LOG: 'sourcecloak-audit-log',
  MODEL_STATE: 'sourcecloak-model-state',
  MODEL_PROGRESS: 'sourcecloak-model-progress',
  STATS: 'sourcecloak-stats',
} as const;

/** Register this ID at https://extensionpay.com and create a one-time Pro plan. */
export const EXTENSION_PAY_ID = 'sourcecloak';

/** Optional plan nickname from ExtensionPay settings; leave empty to show all plans. */
export const PRO_PLAN_NICKNAME = '';

export const PRO_PRICE = 24;
export const PRO_PURCHASE_URL = 'https://sourcecloak.com/pricing';
export const NO_REFUND_NOTICE =
  'All Pro sales are final. Community is free to evaluate before upgrading.';
export const COMMUNITY_MAX_SENSITIVITY = 50;
export const COMMUNITY_MAX_AUDIT_ENTRIES = 50;

export const DEFAULT_SETTINGS = {
  enabled: true,
  sensitivity: 45,
  blockPaste: true,
  blockInput: true,
  useOnnxClassifier: false,
  useGeminiNano: false,
  customPatterns: [] as string[],
  corporateSignatures: [] as string[],
  trustedDomains: [] as string[],
  monitoredDomains: [...COMMUNITY_AI_CHAT_DOMAINS] as string[],
  organizationName: 'Your Organization',
  auditRetentionDays: 30,
  showWarningOverlay: true
} as const;

export const MAX_AUDIT_ENTRIES = 500;
export const CLASSIFICATION_TIMEOUT_MS = 8000;
export const INPUT_THROTTLE_MS = 400;