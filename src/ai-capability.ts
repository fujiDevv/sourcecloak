import { CHROME_GEMINI_FLAG_URL } from './constants';
import { extensionApi } from './platform';
import type { GeminiAvailability } from './types';

export type EnhancedAIReason =
  | 'not_supported'
  | 'model_not_ready'
  | 'unknown'
  | 'ready';

export type LocalAIStatusTier = 'enhanced' | 'optimized' | 'fallback';

export interface EnhancedAICapability {
  available: boolean;
  reason: EnhancedAIReason;
  geminiAvailability: GeminiAvailability;
  quality: 'high' | 'baseline';
  checkedAt: number;
}

export interface AICapabilityRecord {
  enhanced: EnhancedAICapability;
  onnxReady: boolean;
  onnxState: 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
  updatedAt: number;
}

export interface LocalAIStatusInfo {
  tier: LocalAIStatusTier;
  label: string;
  description: string;
  showFlagLink: boolean;
  showRefreshHint: boolean;
}

export const DEFAULT_AI_CAPABILITY: AICapabilityRecord = {
  enhanced: {
    available: false,
    reason: 'unknown',
    geminiAvailability: 'unknown',
    quality: 'baseline',
    checkedAt: 0,
  },
  onnxReady: false,
  onnxState: 'idle',
  updatedAt: 0,
};

export function enhancedFromGeminiAvailability(
  availability: GeminiAvailability,
  checkedAt = Date.now()
): EnhancedAICapability {
  if (availability === 'available') {
    return {
      available: true,
      reason: 'ready',
      geminiAvailability: availability,
      quality: 'high',
      checkedAt,
    };
  }

  if (availability === 'downloadable') {
    return {
      available: true,
      reason: 'ready',
      geminiAvailability: availability,
      quality: 'high',
      checkedAt,
    };
  }

  if (availability === 'downloading') {
    return {
      available: false,
      reason: 'model_not_ready',
      geminiAvailability: availability,
      quality: 'baseline',
      checkedAt,
    };
  }

  if (availability === 'unavailable') {
    return {
      available: false,
      reason: 'not_supported',
      geminiAvailability: availability,
      quality: 'baseline',
      checkedAt,
    };
  }

  return {
    available: false,
    reason: 'unknown',
    geminiAvailability: availability,
    quality: 'baseline',
    checkedAt,
  };
}

export function mergeAICapability(
  current: AICapabilityRecord,
  patch: Partial<AICapabilityRecord> & { enhanced?: Partial<EnhancedAICapability> }
): AICapabilityRecord {
  return {
    ...current,
    ...patch,
    enhanced: {
      ...current.enhanced,
      ...(patch.enhanced ?? {}),
    },
    updatedAt: Date.now(),
  };
}

export function resolveLocalAIStatus(capability: AICapabilityRecord): LocalAIStatusInfo {
  const { enhanced, onnxReady } = capability;

  if (enhanced.available && (enhanced.geminiAvailability === 'available' || enhanced.geminiAvailability === 'downloadable')) {
    return {
      tier: 'enhanced',
      label: 'Enhanced local AI active',
      description: 'Gemini Nano is ready for Tier 4 semantic review. Tier 1–3 ONNX protection runs on every device.',
      showFlagLink: false,
      showRefreshHint: false,
    };
  }

  if (
    enhanced.geminiAvailability === 'downloading' ||
    enhanced.reason === 'model_not_ready'
  ) {
    return {
      tier: 'fallback',
      label: 'Enhanced AI temporarily unavailable',
      description: 'Using high-quality ONNX fallback models. Core blocking and Pro features remain fully active.',
      showFlagLink: false,
      showRefreshHint: true,
    };
  }

  if (onnxReady) {
    return {
      tier: 'optimized',
      label: 'Optimized local AI active',
      description: 'ONNX WASM classifiers power Tier 3 review. Pro policy tools work without Gemini Nano.',
      showFlagLink: false,
      showRefreshHint: false,
    };
  }

  return {
    tier: 'optimized',
    label: 'Optimized local AI active',
    description: enhanced.geminiAvailability === 'unavailable'
      ? 'Tier 1–2 protection is active. ONNX loads on first scan. Gemini Nano is an optional enhancement on supported Chrome builds.'
      : 'Tier 1–2 protection is active. ONNX and optional Gemini Nano enhance detection when models are ready.',
    showFlagLink: enhanced.geminiAvailability === 'unavailable',
    showRefreshHint: false,
  };
}

export function geminiFlagUrl(): string {
  return CHROME_GEMINI_FLAG_URL;
}

export function openGeminiFlagPage(): void {
  extensionApi.tabs.create({ url: CHROME_GEMINI_FLAG_URL }).catch(() => {
    window.open(CHROME_GEMINI_FLAG_URL, '_blank');
  });
}

export function wireFlagLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>('a.flag-link, a[data-gemini-flag]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openGeminiFlagPage();
    });
  });
}