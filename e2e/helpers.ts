import type { Locator, Page } from '@playwright/test';

/** Community edition only scans monitored AI chat hosts — e2e must use one of these. */
export const E2E_MONITORED_ORIGIN = 'https://chatgpt.com';

export const AWS_CREDENTIAL_PASTE =
  'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\naws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

export const BENIGN_PASTE = 'Hello, can you help me write a Python script?';

export async function pasteFromClipboard(page: Page, target: Locator, text: string): Promise<void> {
  await target.focus();
  await page.evaluate(async (payload) => {
    await navigator.clipboard.writeText(payload);
  }, text);

  const isMac = process.platform === 'darwin';
  await target.press(isMac ? 'Meta+v' : 'Control+v');
}

export async function injectFixture(page: Page, html: string): Promise<void> {
  await page.unrouteAll().catch(() => {});

  await page.route(`${E2E_MONITORED_ORIGIN}/**`, async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!DOCTYPE html><html><head><title>SourceCloak E2E</title></head><body>${html}</body></html>`,
      });
      return;
    }
    await route.abort();
  });

  await page.goto(`${E2E_MONITORED_ORIGIN}/`, { waitUntil: 'domcontentloaded' });
  // Content script loads settings async before InputGuard attaches listeners.
  await page.waitForTimeout(1200);
}