import type { ClassificationResult, SourceCloakSettings, ThreatMatch } from './types';
import { runPatternScan } from './patterns';
import { aggregateScore, scoreProprietaryTokens } from './token-scorer';

export function classifyWithRules(text: string, settings: SourceCloakSettings): ClassificationResult {
  const started = performance.now();

  if (!text || text.trim().length < 4) {
    return { blocked: false, score: 0, matches: [], processingMs: performance.now() - started };
  }

  const regexMatches = runPatternScan(text, settings.customPatterns, settings.corporateSignatures);
  const tokenMatches = scoreProprietaryTokens(text);
  const matches = dedupeMatches([...regexMatches, ...tokenMatches]);
  const score = aggregateScore(matches, settings.sensitivity);
  const threshold = 0.9 - (settings.sensitivity / 100) * 0.45;
  const blocked = matches.some((m) => m.confidence >= 0.85) || score >= threshold;

  return {
    blocked,
    score,
    matches,
    processingMs: performance.now() - started
  };
}

export function mergeClassificationResults(
  base: ClassificationResult,
  extra: ClassificationResult
): ClassificationResult {
  const matches = dedupeMatches([...base.matches, ...extra.matches]);
  const score = Math.max(base.score, extra.score);
  return {
    blocked: base.blocked || extra.blocked,
    score,
    matches,
    processingMs: base.processingMs + extra.processingMs
  };
}

function dedupeMatches(matches: ThreatMatch[]): ThreatMatch[] {
  const seen = new Set<string>();
  const output: ThreatMatch[] = [];

  for (const match of matches) {
    const key = `${match.category}:${match.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(match);
  }

  return output.sort((a, b) => b.confidence - a.confidence);
}