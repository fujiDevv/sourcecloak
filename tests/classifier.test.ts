import { describe, expect, it } from 'vitest';
import { classifyWithRules } from '../src/classifier';
import { DEFAULT_SETTINGS } from '../src/constants';

const settings = { ...DEFAULT_SETTINGS };

describe('classifyWithRules', () => {
  it('blocks obvious secrets', () => {
    const result = classifyWithRules('aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"', settings);
    expect(result.blocked).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('allows benign text', () => {
    const result = classifyWithRules('hello team, meeting at 3pm', settings);
    expect(result.blocked).toBe(false);
  });

  it('respects sensitivity for code-like payloads', () => {
    const code = Array.from({ length: 12 }, (_, i) => `internal function handler_${i}() { return secret_key; }`).join('\n');
    const strict = classifyWithRules(code, { ...settings, sensitivity: 90 });
    const relaxed = classifyWithRules(code, { ...settings, sensitivity: 20 });
    expect(strict.score).toBeGreaterThanOrEqual(relaxed.score);
  });
});