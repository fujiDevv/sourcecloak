import { test, expect } from './fixtures';
import {
  AWS_CREDENTIAL_PASTE,
  injectFixture,
  pasteFromClipboard,
} from './helpers';

/**
 * Ensures classification still blocks high-risk paste when Gemini Nano
 * returns unparseable / truncated JSON (Tier 1–3 fallback path).
 * Does not require a Vite dev server.
 */
test.describe('SourceCloak Gemini fallback', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('still blocks credentials when Gemini returns malformed JSON', async ({ page }) => {
    // Mock Prompt API / LanguageModel in the page world before content scripts run.
    await page.addInitScript(() => {
      const brokenSession = {
        prompt: async () =>
          '```json\n{\n  "blocked": true,\n  "confidence": 0.9,\n  "reason": "Truncated json example...',
        destroy: async () => {},
      };

      const languageModel = {
        availability: async () => 'available',
        create: async () => brokenSession,
      };

      Object.defineProperty(window, 'ai', {
        configurable: true,
        value: { languageModel },
      });
      Object.defineProperty(window, 'LanguageModel', {
        configurable: true,
        value: languageModel,
      });
    });

    await injectFixture(
      page,
      '<textarea id="target" style="width: 100%; height: 200px;"></textarea>',
    );

    const textarea = page.locator('#target');
    await pasteFromClipboard(page, textarea, AWS_CREDENTIAL_PASTE);

    // Rule tiers (or resilient AI parse) must still block — overlay id from warning-overlay.ts
    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await expect(overlay).toContainText('Transmission Blocked');
    await expect(textarea).toHaveValue('');
  });
});
