import { describe, expect, it } from 'vitest';
import { isGeminiClassificationReady } from '../src/gemini-ready';

describe('isGeminiClassificationReady', () => {
  it('only allows available state', () => {
    expect(isGeminiClassificationReady('available')).toBe(true);
    expect(isGeminiClassificationReady('downloadable')).toBe(false);
    expect(isGeminiClassificationReady('downloading')).toBe(false);
    expect(isGeminiClassificationReady('unavailable')).toBe(false);
  });
});