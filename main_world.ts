(() => {
  const currentScript = document.currentScript as HTMLScriptElement | null;

  function getLanguageModel(): {
    availability?: (opts?: unknown) => Promise<string>;
    capabilities?: (opts?: unknown) => Promise<{ available: string }>;
    create: (opts: Record<string, unknown>) => Promise<{
      prompt: (text: string) => Promise<string>;
      destroy?: () => Promise<void>;
      close?: () => Promise<void>;
    }>;
  } | null {
    const scope = globalThis as {
      ai?: { languageModel?: unknown };
      LanguageModel?: unknown;
    };
    return (scope.ai?.languageModel || scope.LanguageModel || null) as ReturnType<typeof getLanguageModel>;
  }

  window.addEventListener('message', (initEvent) => {
    if (initEvent.source !== window || !initEvent.data) return;
    if (initEvent.data.type === 'SOURCECLOAK_AI_INIT_PORT' && initEvent.ports[0]) {
      const port = initEvent.ports[0];
      port.onmessage = async (event) => {
        if (!event.data) return;

        if (event.data.type === 'SOURCECLOAK_AI_AVAILABILITY_REQUEST') {
          const lm = getLanguageModel();
          let availability: string = 'unavailable';

          if (lm) {
            try {
              if (typeof lm.availability === 'function') {
                availability = await lm.availability({
                  expectedOutputs: [{ type: 'text', languages: ['en'] }]
                });
              } else if (typeof lm.capabilities === 'function') {
                const caps = await lm.capabilities({ expectedOutputs: [{ type: 'text', languages: ['en'] }] });
                availability = caps.available;
              }
            } catch (err) {
              console.warn('[SourceCloak] Gemini Nano availability check failed:', err);
            }
          }

          port.postMessage({
            type: 'SOURCECLOAK_AI_AVAILABILITY_RESPONSE',
            id: event.data.id,
            availability
          });
        }

        if (event.data.type === 'SOURCECLOAK_AI_PROMPT_REQUEST') {
          const { id, systemPrompt, prompt } = event.data;
          const lm = getLanguageModel();

          if (!lm) {
            port.postMessage({
              type: 'SOURCECLOAK_AI_PROMPT_RESPONSE',
              id,
              error: 'Prompt API unavailable in page context'
            });
            return;
          }

          let session: Awaited<ReturnType<NonNullable<ReturnType<typeof getLanguageModel>>['create']>> | null = null;

          try {
            let availability = 'unavailable';
            if (typeof lm.availability === 'function') {
              availability = await lm.availability();
            } else if (typeof lm.capabilities === 'function') {
              const caps = await lm.capabilities({ expectedOutputs: [{ type: 'text', languages: ['en'] }] });
              availability = caps.available;
            }

            if (availability !== 'available' && availability !== 'downloadable' && availability !== 'downloading') {
              port.postMessage({
                type: 'SOURCECLOAK_AI_PROMPT_RESPONSE',
                id,
                error: `Gemini Nano not ready: ${availability}`
              });
              return;
            }

            session = await lm.create({
              systemPrompt,
              initialPrompts: [{ role: 'system', content: systemPrompt }],
              expectedOutputs: [{ type: 'text', languages: ['en'] }]
            });

            const resultText = await session.prompt(prompt);
            port.postMessage({
              type: 'SOURCECLOAK_AI_PROMPT_RESPONSE',
              id,
              resultText
            });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            port.postMessage({
              type: 'SOURCECLOAK_AI_PROMPT_RESPONSE',
              id,
              error: message
            });
          } finally {
            if (session) {
              try {
                if (typeof session.destroy === 'function') await session.destroy();
                else if (typeof session.close === 'function') await session.close();
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        }
      };
      port.start();
    }
  });
})();