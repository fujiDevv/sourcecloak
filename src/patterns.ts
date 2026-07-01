import type { ThreatCategory, ThreatMatch } from './types';

export interface PatternRule {
  id: string;
  category: ThreatCategory;
  label: string;
  regex: RegExp;
  weight: number;
  maskGroup?: number;
}

const SSH_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]{0,8000}?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;

export const BUILTIN_PATTERNS: PatternRule[] = [
  {
    id: 'ssh-private-key',
    category: 'ssh_private_key',
    label: 'SSH Private Key',
    regex: SSH_KEY_PATTERN,
    weight: 1.0
  },
  {
    id: 'aws-access-key',
    category: 'api_credential',
    label: 'AWS Access Key',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    weight: 0.95
  },
  {
    id: 'aws-secret-key',
    category: 'api_credential',
    label: 'AWS Secret Key',
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i,
    weight: 0.95
  },
  {
    id: 'github-pat',
    category: 'api_credential',
    label: 'GitHub Personal Access Token',
    regex: /\bghp_[A-Za-z0-9]{36,}\b/,
    weight: 0.95
  },
  {
    id: 'github-oauth',
    category: 'api_credential',
    label: 'GitHub OAuth Token',
    regex: /\bgho_[A-Za-z0-9]{36,}\b/,
    weight: 0.95
  },
  {
    id: 'slack-token',
    category: 'api_credential',
    label: 'Slack Token',
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
    weight: 0.9
  },
  {
    id: 'stripe-key',
    category: 'api_credential',
    label: 'Stripe API Key',
    regex: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}\b/,
    weight: 0.95
  },
  {
    id: 'jwt-token',
    category: 'jwt_token',
    label: 'JWT Token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    weight: 0.85
  },
  {
    id: 'env-secret',
    category: 'env_secret',
    label: 'Environment Secret',
    regex: /(?:SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN)\s*=\s*['"]?[^\s'"]{8,}['"]?/i,
    weight: 0.8
  },
  {
    id: 'database-url',
    category: 'database_credential',
    label: 'Database Connection String',
    regex: /(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/i,
    weight: 0.9
  },
  {
    id: 'internal-api-route',
    category: 'internal_api',
    label: 'Internal API Route',
    regex: /\/(?:internal|private|admin|corp|intranet)\/[a-z0-9/_-]{3,}/i,
    weight: 0.55
  },
  {
    id: 'corp-config-signature',
    category: 'corporate_config',
    label: 'Corporate Config Block',
    regex: /(?:company|corp|enterprise)[_-]?(?:config|settings|manifest)\s*[:=]\s*\{/i,
    weight: 0.6
  },
  {
    id: 'proprietary-header',
    category: 'proprietary_code',
    label: 'Proprietary Source Header',
    regex: /(?:CONFIDENTIAL|PROPRIETARY|TRADE SECRET|INTERNAL USE ONLY)/,
    weight: 0.75
  },
  {
    id: 'internal-package',
    category: 'proprietary_code',
    label: 'Internal Package Reference',
    regex: /(?:@corp\/|@internal\/|com\.[a-z]+\.internal\.)/i,
    weight: 0.65
  }
];

export function maskSnippet(text: string, maxLen = 48): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 3)}...`;
}

export function runPatternScan(text: string, customPatterns: string[] = [], corporateSignatures: string[] = []): ThreatMatch[] {
  const matches: ThreatMatch[] = [];
  const seen = new Set<string>();

  const allRules: PatternRule[] = [...BUILTIN_PATTERNS];

  for (const signature of corporateSignatures) {
    const trimmed = signature.trim();
    if (!trimmed) continue;
    try {
      allRules.push({
        id: `corp-${trimmed}`,
        category: 'corporate_config',
        label: `Corporate Signature: ${trimmed}`,
        regex: new RegExp(trimmed, 'i'),
        weight: 0.85
      });
    } catch {
      allRules.push({
        id: `corp-literal-${trimmed}`,
        category: 'corporate_config',
        label: `Corporate Signature: ${trimmed}`,
        regex: new RegExp(escapeRegex(trimmed), 'i'),
        weight: 0.85
      });
    }
  }

  for (const pattern of customPatterns) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;
    try {
      allRules.push({
        id: `custom-${trimmed}`,
        category: 'custom_pattern',
        label: `Custom Pattern: ${trimmed}`,
        regex: new RegExp(trimmed, 'i'),
        weight: 0.9
      });
    } catch {
      allRules.push({
        id: `custom-literal-${trimmed}`,
        category: 'custom_pattern',
        label: `Custom Pattern: ${trimmed}`,
        regex: new RegExp(escapeRegex(trimmed), 'i'),
        weight: 0.9
      });
    }
  }

  for (const rule of allRules) {
    const hit = rule.regex.exec(text);
    if (!hit || seen.has(rule.id)) continue;
    seen.add(rule.id);
    matches.push({
      category: rule.category,
      label: rule.label,
      confidence: rule.weight,
      tier: 'regex',
      snippet: maskSnippet(hit[0])
    });
  }

  return matches;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}