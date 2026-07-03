import type { GeminiAvailability } from './types';
import {
  geminiFlagUrl,
  openGeminiFlagPage,
  resolveLocalAIStatus,
  wireFlagLinks,
  type AICapabilityRecord,
  type LocalAIStatusInfo,
} from './ai-capability';

export type { LocalAIStatusInfo };

/** @deprecated Prefer resolveLocalAIStatus with AICapabilityRecord */
export interface GeminiStatusInfo {
  availability: GeminiAvailability;
  label: string;
  description: string;
  ready: boolean;
  showFlagLink: boolean;
}

const LEGACY_STATUS_MAP: Record<GeminiAvailability, Omit<GeminiStatusInfo, 'availability'>> = {
  available: {
    label: 'Ready',
    description: 'Gemini Nano is available for Tier 4 semantic review on this device.',
    ready: true,
    showFlagLink: false,
  },
  downloadable: {
    label: 'Downloadable',
    description: 'Gemini Nano can be downloaded. Chrome may prompt you to install the on-device model.',
    ready: true,
    showFlagLink: false,
  },
  downloading: {
    label: 'Downloading',
    description: 'Gemini Nano model is downloading. Tier 4 review will activate when the download completes.',
    ready: false,
    showFlagLink: false,
  },
  unavailable: {
    label: 'Unavailable',
    description: 'Gemini Nano is not available. Enable the Prompt API flag in Chrome to unlock Tier 4 semantic review.',
    ready: false,
    showFlagLink: true,
  },
  unknown: {
    label: 'Checking…',
    description: 'Detecting Gemini Nano availability on the active tab.',
    ready: false,
    showFlagLink: false,
  },
};

export function formatLocalAIStatus(capability: AICapabilityRecord): LocalAIStatusInfo {
  return resolveLocalAIStatus(capability);
}

export function formatGeminiStatus(availability: GeminiAvailability): GeminiStatusInfo {
  const info = LEGACY_STATUS_MAP[availability] ?? LEGACY_STATUS_MAP.unknown;
  return { availability, ...info };
}

export { geminiFlagUrl, openGeminiFlagPage, wireFlagLinks };