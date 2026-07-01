import type { ThreatMatch } from './types';

const PROPRIETARY_TOKENS = new Set([
  'confidential', 'proprietary', 'internal', 'intranet', 'corp', 'enterprise',
  'private_key', 'secret_key', 'access_token', 'refresh_token', 'client_secret',
  'service_account', 'vault', 'kms', 'hmac', 'bearer', 'authorization',
  'connectionstring', 'jdbc', 'datasource', 'keystore', 'truststore'
]);

const CODE_STRUCTURE_TOKENS = new Set([
  'class', 'interface', 'function', 'export', 'import', 'const', 'let', 'var',
  'async', 'await', 'return', 'implements', 'extends', 'namespace', 'module',
  'def', 'lambda', 'struct', 'enum', 'trait', 'impl', 'package', 'public', 'private'
]);

const INTERNAL_API_MARKERS = [
  /\/api\/v\d+\/internal\b/i,
  /\/graphql\b[\s\S]{0,200}?(?:mutation|query)\s+\w+Internal/i,
  /x-(?:corp|internal|company)-[a-z-]+/i,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/i,
  /process\.env\.[A-Z0-9_]{4,}/,
  /getenv\(['"][A-Z0-9_]{4,}['"]\)/,
  /os\.environ\[['"][A-Z0-9_]{4,}['"]\]/,
  /kubectl\s+apply\s+-f/,
  /terraform\s*\{[\s\S]{0,500}?backend\s+"/,
  /BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK/
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_$/.\-:]+/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function scoreProprietaryTokens(text: string): ThreatMatch[] {
  const matches: ThreatMatch[] = [];
  const tokens = tokenize(text);
  if (tokens.length === 0) return matches;

  let proprietaryHits = 0;
  let codeHits = 0;

  for (const token of tokens) {
    if (PROPRIETARY_TOKENS.has(token)) proprietaryHits++;
    if (CODE_STRUCTURE_TOKENS.has(token)) codeHits++;
  }

  const proprietaryRatio = proprietaryHits / tokens.length;
  const codeRatio = codeHits / tokens.length;
  const lineCount = text.split('\n').length;
  const looksLikeCode = codeRatio > 0.08 || /[{}();=<>]/.test(text);

  if (proprietaryRatio >= 0.04 && looksLikeCode) {
    matches.push({
      category: 'proprietary_code',
      label: 'Proprietary Token Density',
      confidence: Math.min(0.55 + proprietaryRatio * 2, 0.88),
      tier: 'token'
    });
  }

  if (lineCount >= 8 && looksLikeCode && proprietaryHits >= 2) {
    matches.push({
      category: 'proprietary_code',
      label: 'Multi-line Proprietary Code Block',
      confidence: Math.min(0.5 + lineCount * 0.02 + proprietaryHits * 0.05, 0.82),
      tier: 'token'
    });
  }

  for (const marker of INTERNAL_API_MARKERS) {
    const hit = marker.exec(text);
    if (!hit) continue;
    matches.push({
      category: 'internal_api',
      label: 'Internal API Structure',
      confidence: 0.72,
      tier: 'token',
      snippet: hit[0].slice(0, 48)
    });
    break;
  }

  return matches;
}

export function aggregateScore(matches: ThreatMatch[], sensitivity: number): number {
  if (matches.length === 0) return 0;

  const tierBoost: Record<string, number> = {
    regex: 1.0,
    token: 0.85,
    onnx: 0.9,
    gemini: 0.95
  };

  const raw = matches.reduce((max, match) => {
    const boosted = match.confidence * (tierBoost[match.tier] ?? 1);
    return Math.max(max, boosted);
  }, 0);

  const threshold = 0.9 - (sensitivity / 100) * 0.45;
  if (raw < threshold * 0.6) return raw * 0.8;
  return raw;
}