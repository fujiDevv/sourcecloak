import { CHROME_GEMINI_FLAG_URL } from './constants';
import { extensionApi } from './platform';
import type { GeminiAvailability } from './types';

export interface GeminiStatusInfo {
  availability: GeminiAvailability;
  label: string;
  description: string;
  ready: boolean;
  showFlagLink: boolean;
}

const STATUS_MAP: Record<GeminiAvailability, Omit<GeminiStatusInfo, 'availability'>> = {
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

export function formatGeminiStatus(availability: GeminiAvailability): GeminiStatusInfo {
  const info = STATUS_MAP[availability] ?? STATUS_MAP.unknown;
  return { availability, ...info };
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