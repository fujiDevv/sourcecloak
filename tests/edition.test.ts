import { describe, expect, it } from 'vitest';
import { sanitizeSettings } from '../src/edition';
import { DEFAULT_SETTINGS } from '../src/constants';

describe('sanitizeSettings', () => {
  it('strips Pro-only settings for Community edition', () => {
    const raw = {
      ...DEFAULT_SETTINGS,
      useOnnxClassifier: true,
      useGeminiNano: true,
      customPatterns: ['@acme/internal'],
      corporateSignatures: ['ACME_CONFIG'],
      trustedDomains: ['localhost'],
      monitoredDomains: ['example.com'],
      sensitivity: 90,
    };

    const sanitized = sanitizeSettings(raw, 'community');

    expect(sanitized.useOnnxClassifier).toBe(true);
    expect(sanitized.useGeminiNano).toBe(false);
    expect(sanitized.customPatterns).toEqual([]);
    expect(sanitized.corporateSignatures).toEqual([]);
    expect(sanitized.trustedDomains).toEqual([]);
    expect(sanitized.monitoredDomains.length).toBeGreaterThan(0);
    expect(sanitized.sensitivity).toBeLessThanOrEqual(50);
  });

  it('preserves Pro settings for Pro edition', () => {
    const raw = {
      ...DEFAULT_SETTINGS,
      useOnnxClassifier: true,
      customPatterns: ['@acme/internal'],
      sensitivity: 80,
    };

    const sanitized = sanitizeSettings(raw, 'pro');

    expect(sanitized.useOnnxClassifier).toBe(true);
    expect(sanitized.customPatterns).toEqual(['@acme/internal']);
    expect(sanitized.sensitivity).toBe(80);
  });
});