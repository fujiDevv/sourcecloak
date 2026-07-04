import type { GeminiAvailability } from './types';

/** Gemini Prompt API can run classification (model loaded and ready). */
export function isGeminiClassificationReady(availability: GeminiAvailability | string): boolean {
  return availability === 'available';
}