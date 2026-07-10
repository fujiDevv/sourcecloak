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
/** Keep Pro active offline after last successful validation. */
export const LICENSE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/** True in local dev builds — unlocks Pro without Lemon Squeezy. Never enable for store releases. */
export const DEV_PRO_UNLOCK = import.meta.env.VITE_DEV_PRO_UNLOCK === 'true';

export { PRO_PRICE, NO_REFUND_NOTICE, PRICING } from './pricing';
export const PRO_PURCHASE_URL = 'https://sourcecloak.com/pricing';

/** @deprecated Use NO_REFUND_NOTICE */
export const REFUND_POLICY =
  'All Pro purchases are final and non-refundable. Evaluate Community and run compatibility checks before upgrading.';

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