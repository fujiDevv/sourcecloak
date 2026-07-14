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

/** True in local dev builds — unlocks Pro without Lemon Squeezy. Never enable for store releases. */
export const DEV_PRO_UNLOCK = true;

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