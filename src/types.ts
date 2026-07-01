export type ThreatCategory =
  | 'ssh_private_key'
  | 'api_credential'
  | 'env_secret'
  | 'jwt_token'
  | 'internal_api'
  | 'proprietary_code'
  | 'corporate_config'
  | 'database_credential'
  | 'custom_pattern';

export type ClassificationTier = 'regex' | 'token' | 'onnx' | 'gemini';

export interface ThreatMatch {
  category: ThreatCategory;
  label: string;
  confidence: number;
  tier: ClassificationTier;
  snippet?: string;
}

export interface ClassificationResult {
  blocked: boolean;
  score: number;
  matches: ThreatMatch[];
  processingMs: number;
}

export interface ShieldSettings {
  enabled: boolean;
  sensitivity: number;
  blockPaste: boolean;
  blockInput: boolean;
  useOnnxClassifier: boolean;
  useGeminiNano: boolean;
  customPatterns: string[];
  corporateSignatures: string[];
  trustedDomains: string[];
  monitoredDomains: string[];
  organizationName: string;
  auditRetentionDays: number;
  showWarningOverlay: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  hostname: string;
  url: string;
  eventType: 'paste' | 'input';
  blocked: boolean;
  score: number;
  matches: ThreatMatch[];
  elementTag: string;
}

export interface ShieldStats {
  totalScans: number;
  totalBlocks: number;
  lastBlockTime?: number;
  blocksByCategory: Record<string, number>;
}

export type ShieldMessage =
  | { type: 'classify-payload'; text: string; hostname: string; url: string; eventType: 'paste' | 'input'; elementTag: string }
  | { type: 'classification-result'; result: ClassificationResult }
  | { type: 'log-audit-entry'; entry: AuditEntry }
  | { type: 'get-settings' }
  | { type: 'get-stats' }
  | { type: 'get-audit-log' }
  | { type: 'check-model-status' }
  | { type: 'update-model-progress'; state: string; progress: number }
  | { type: 'run-offscreen-classification'; text: string; settings: ShieldSettings }
  | { type: 'check-offscreen-model-status' }
  | { type: 'show-block-warning'; matches: ThreatMatch[]; hostname: string };