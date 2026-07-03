import { COMMUNITY_AI_CHAT_DOMAINS } from './presets';

export const STORAGE_KEYS = {
  SETTINGS: 'sourcecloak-settings',
  AUDIT_LOG: 'sourcecloak-audit-log',
  MODEL_STATE: 'sourcecloak-model-state',
  MODEL_PROGRESS: 'sourcecloak-model-progress',
  STATS: 'sourcecloak-stats',
  LICENSE: 'sourcecloak-license',
  AI_CAPABILITY: 'ai_capability',
  AI_FALLBACK_LOGGED: 'sourcecloak-ai-fallback-logged',
  WELCOME_SEEN: 'sourcecloak-welcome-seen',
} as const;

/**
 * Lemon Squeezy checkout URL for SourceCloak Pro ($24 lifetime).
 * Find this under Products → Share → Checkout link in your Lemon Squeezy dashboard.
 * Format: https://{store}.lemonsqueezy.com/checkout/buy/{variant-id}
 */
export const LEMON_SQUEEZY_CHECKOUT_URL = 'https://sourcecloak.lemonsqueezy.com/checkout/buy/cad7f7d2-99ed-43ca-925a-6830bc8e5641';

/** Revalidate stored license against Lemon Squeezy (ms). */
export const LICENSE_VALIDATION_TTL_MS = 24 * 60 * 60 * 1000;

export const PRO_PRICE = 24;
export const PRO_PURCHASE_URL = 'https://sourcecloak.com/pricing';
export const REFUND_POLICY =
  'If enhanced AI is not available on your device and you are not satisfied with the baseline Pro experience, contact support within 14 days for a full refund.';

/** @deprecated Use REFUND_POLICY */
export const NO_REFUND_NOTICE = REFUND_POLICY;

export const DEVICE_COMPATIBILITY_URL = 'https://sourcecloak.com/compatibility';
export const STORE_VALUE_PROPOSITION =
  'Core features and the full Pro experience work on any modern Chrome. Enhanced semantic AI (Gemini Nano) activates automatically on supported devices (recent hardware, Chrome 128+). No cloud required.';
export const COMMUNITY_MAX_SENSITIVITY = 50;
export const COMMUNITY_MAX_AUDIT_ENTRIES = 50;

export const DEFAULT_SETTINGS = {
  enabled: true,
  sensitivity: 45,
  blockPaste: true,
  blockInput: true,
  useOnnxClassifier: true,
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

export const CHROME_GEMINI_FLAG_URL = 'chrome://flags/#prompt-api-for-gemini-nano';