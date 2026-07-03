import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_CAPABILITY,
  enhancedFromGeminiAvailability,
  mergeAICapability,
  resolveLocalAIStatus,
} from '../src/ai-capability';

describe('enhancedFromGeminiAvailability', () => {
  it('marks available Gemini as enhanced-ready', () => {
    const enhanced = enhancedFromGeminiAvailability('available');
    expect(enhanced.available).toBe(true);
    expect(enhanced.reason).toBe('ready');
    expect(enhanced.quality).toBe('high');
  });

  it('marks unavailable Gemini as baseline', () => {
    const enhanced = enhancedFromGeminiAvailability('unavailable');
    expect(enhanced.available).toBe(false);
    expect(enhanced.reason).toBe('not_supported');
    expect(enhanced.quality).toBe('baseline');
  });
});

describe('resolveLocalAIStatus', () => {
  it('returns enhanced tier when Gemini is ready', () => {
    const capability = mergeAICapability(DEFAULT_AI_CAPABILITY, {
      onnxReady: true,
      enhanced: enhancedFromGeminiAvailability('available'),
    });
    expect(resolveLocalAIStatus(capability).tier).toBe('enhanced');
  });

  it('returns optimized tier when only ONNX is ready', () => {
    const capability = mergeAICapability(DEFAULT_AI_CAPABILITY, {
      onnxReady: true,
      enhanced: enhancedFromGeminiAvailability('unavailable'),
    });
    expect(resolveLocalAIStatus(capability).tier).toBe('optimized');
  });

  it('returns fallback tier while Gemini is downloading', () => {
    const capability = mergeAICapability(DEFAULT_AI_CAPABILITY, {
      onnxReady: true,
      enhanced: enhancedFromGeminiAvailability('downloading'),
    });
    expect(resolveLocalAIStatus(capability).tier).toBe('fallback');
  });
});