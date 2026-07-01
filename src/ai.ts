import { extensionApi } from './platform';

let mainWorldPort: MessagePort | null = null;

export function setMainWorldPort(port: MessagePort): void {
  mainWorldPort = port;
  mainWorldPort.start();
}

export async function checkGeminiNanoAvailability(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'> {
  const lm = (globalThis as { LanguageModel?: { availability?: (opts: unknown) => Promise<string> } }).LanguageModel
    || (typeof window !== 'undefined' ? (window as { LanguageModel?: { availability?: (opts: unknown) => Promise<string> } }).LanguageModel : null);

  if (lm?.availability) {
    try {
      return await lm.availability({
        language: 'en',
        expectedOutputs: [{ type: 'text', languages: ['en'] }]
      }) as 'available' | 'downloadable' | 'downloading' | 'unavailable';
    } catch {
      // Fall through to bridge
    }
  }

  if (typeof window === 'undefined') return 'unavailable';
  if (window.location.protocol.startsWith('chrome-extension:') || window.location.protocol.startsWith('moz-extension:')) {
    return 'unavailable';
  }

  if (!mainWorldPort) return 'unavailable';

  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    let resolved = false;

    const handler = (event: MessageEvent) => {
      if (resolved) return;
      if (
        !event.data ||
        event.data.type !== 'SHIELD_AI_AVAILABILITY_RESPONSE' ||
        event.data.id !== requestId
      ) return;

      resolved = true;
      mainWorldPort!.removeEventListener('message', handler);
      resolve(event.data.availability);
    };

    mainWorldPort!.addEventListener('message', handler);
    mainWorldPort!.postMessage({ type: 'SHIELD_AI_AVAILABILITY_REQUEST', id: requestId });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        mainWorldPort!.removeEventListener('message', handler);
        resolve('unavailable');
      }
    }, 2000);
  });
}

export async function classifyWithGeminiNano(text: string): Promise<{ blocked: boolean; reason?: string; confidence: number } | null> {
  const availability = await checkGeminiNanoAvailability();
  if (availability !== 'available' && availability !== 'downloadable' && availability !== 'downloading') {
    return null;
  }

  const truncated = text.length > 2500 ? `${text.slice(0, 2500)}...` : text;
  const systemPrompt = `You are a security classifier for an enterprise code-leak prevention system.
Analyze pasted text and decide if it contains proprietary source code, secrets, credentials, or internal corporate material.
Respond ONLY with JSON: {"blocked": boolean, "confidence": number, "reason": string}
Confidence is 0-1. Block when confidence >= 0.7.`;

  const prompt = `Classify this payload:\n\n${truncated}`;
  const resultText = await promptGeminiNano(systemPrompt, prompt);
  if (!resultText) return null;

  try {
    let clean = resultText.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
    }
    const parsed = JSON.parse(clean);
    return {
      blocked: !!parsed.blocked,
      reason: parsed.reason,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7
    };
  } catch {
    return null;
  }
}

export async function promptGeminiNano(systemPrompt: string, prompt: string): Promise<string | null> {
  const lm = (globalThis as {
    ai?: { languageModel?: LanguageModelProvider };
    LanguageModel?: LanguageModelProvider;
  }).ai?.languageModel
    || (globalThis as { LanguageModel?: LanguageModelProvider }).LanguageModel
    || (typeof window !== 'undefined'
      ? ((window as { ai?: { languageModel?: LanguageModelProvider }; LanguageModel?: LanguageModelProvider }).ai?.languageModel
        || (window as { LanguageModel?: LanguageModelProvider }).LanguageModel)
      : null);

  if (lm) {
    try {
      const session = await lm.create({
        systemPrompt,
        initialPrompts: [{ role: 'system', content: systemPrompt }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }]
      });
      const result = await session.prompt(prompt);
      await session.destroy();
      return result;
    } catch {
      // Fall through to bridge
    }
  }

  if (typeof window === 'undefined') return null;
  if (window.location.protocol.startsWith('chrome-extension:') || window.location.protocol.startsWith('moz-extension:')) {
    return null;
  }

  if (!mainWorldPort) return null;

  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    let resolved = false;

    const handler = (event: MessageEvent) => {
      if (resolved) return;
      if (
        !event.data ||
        event.data.type !== 'SHIELD_AI_PROMPT_RESPONSE' ||
        event.data.id !== requestId
      ) return;

      resolved = true;
      mainWorldPort!.removeEventListener('message', handler);
      resolve(event.data.error ? null : event.data.resultText);
    };

    mainWorldPort!.addEventListener('message', handler);
    mainWorldPort!.postMessage({
      type: 'SHIELD_AI_PROMPT_REQUEST',
      id: requestId,
      systemPrompt,
      prompt
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        mainWorldPort!.removeEventListener('message', handler);
        resolve(null);
      }
    }, 12000);
  });
}

interface LanguageModelSession {
  prompt(text: string): Promise<string>;
  destroy(): Promise<void>;
}

interface LanguageModelProvider {
  create(options: Record<string, unknown>): Promise<LanguageModelSession>;
}

export async function requestBackgroundClassification(text: string): Promise<import('./types').ClassificationResult | null> {
  try {
    const response = await extensionApi.runtime.sendMessage<{
      success: boolean;
      result?: import('./types').ClassificationResult;
      error?: string;
    }>({
      type: 'classify-payload',
      text,
      hostname: typeof location !== 'undefined' ? location.hostname : 'unknown',
      url: typeof location !== 'undefined' ? location.href : 'unknown',
      eventType: 'paste',
      elementTag: 'unknown'
    });

    if (!response?.success || !response.result) return null;
    return response.result;
  } catch {
    return null;
  }
}