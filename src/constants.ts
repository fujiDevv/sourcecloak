export const STORAGE_KEYS = {
  SETTINGS: 'sourcecloak-settings',
  AUDIT_LOG: 'sourcecloak-audit-log',
  MODEL_STATE: 'sourcecloak-model-state',
  MODEL_PROGRESS: 'sourcecloak-model-progress',
  STATS: 'sourcecloak-stats'
} as const;

export const DEFAULT_SETTINGS = {
  enabled: true,
  sensitivity: 65,
  blockPaste: true,
  blockInput: true,
  useOnnxClassifier: true,
  useGeminiNano: true,
  customPatterns: [] as string[],
  corporateSignatures: [] as string[],
  trustedDomains: [] as string[],
  monitoredDomains: [] as string[],
  organizationName: 'Your Organization',
  auditRetentionDays: 30,
  showWarningOverlay: true
} as const;

export const MAX_AUDIT_ENTRIES = 500;
export const CLASSIFICATION_TIMEOUT_MS = 8000;
export const INPUT_THROTTLE_MS = 400;