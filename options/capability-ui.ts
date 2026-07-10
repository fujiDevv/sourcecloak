import type { AICapabilityRecord } from '../src/ai-capability';
import { STORAGE_KEYS } from '../src/constants';
import { formatLocalAIStatus, geminiFlagUrl, wireFlagLinks } from '../src/gemini-status';
import { extensionApi } from '../src/platform';
import { el } from './dom';

export interface CapabilityUi {
  load: (forceRefresh?: boolean) => Promise<void>;
  bind: () => void;
}

export function createCapabilityUi(): CapabilityUi {
  const aiCapabilityBanner = el<HTMLElement>('ai-capability-banner');
  const aiCapabilityLabel = el<HTMLHeadingElement>('ai-capability-label');
  const aiCapabilityTier = el<HTMLSpanElement>('ai-capability-tier');
  const aiCapabilityDesc = el<HTMLParagraphElement>('ai-capability-desc');
  const refreshAICapabilityBtn = el<HTMLButtonElement>('refresh-ai-capability');

  function applyCapabilityUi(capability: AICapabilityRecord): void {
    const info = formatLocalAIStatus(capability);
    aiCapabilityBanner.classList.remove(
      'ai-banner-enhanced',
      'ai-banner-optimized',
      'ai-banner-fallback'
    );
    aiCapabilityBanner.classList.add(`ai-banner-${info.tier}`);
    aiCapabilityLabel.textContent = info.label;
    aiCapabilityTier.textContent = info.tier === 'enhanced' ? 'Gemini Nano' : 'ONNX';
    aiCapabilityTier.className = `status-pill ai-tier-${info.tier}`;

    if (info.showFlagLink) {
      aiCapabilityDesc.innerHTML = `${info.description} Enable <a href="${geminiFlagUrl()}" class="flag-link">Prompt API for Gemini Nano</a> in <code>chrome://flags</code> for Tier 4.`;
      wireFlagLinks(aiCapabilityBanner);
    } else {
      aiCapabilityDesc.textContent = info.description;
    }
  }

  async function load(forceRefresh = false): Promise<void> {
    const type = forceRefresh ? 'refresh-ai-capability' : 'get-ai-capability';
    const res = await extensionApi.runtime.sendMessage<{
      success?: boolean;
      capability?: AICapabilityRecord;
    }>({ type });

    if (res?.capability) {
      applyCapabilityUi(res.capability);
    }
  }

  function bind(): void {
    refreshAICapabilityBtn.addEventListener('click', async () => {
      refreshAICapabilityBtn.disabled = true;
      await load(true);
      refreshAICapabilityBtn.disabled = false;
    });

    extensionApi.storage.onChanged?.addListener(
      (changes: Record<string, chrome.storage.StorageChange>) => {
        if (changes[STORAGE_KEYS.AI_CAPABILITY]) {
          const capability = changes[STORAGE_KEYS.AI_CAPABILITY].newValue as
            | AICapabilityRecord
            | undefined;
          if (capability) applyCapabilityUi(capability);
        }
      }
    );
  }

  return { load, bind };
}
