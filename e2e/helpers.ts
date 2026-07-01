import type { Locator, Page } from '@playwright/test';

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
  await page.goto('https://example.com');
  await page.evaluate((markup) => {
    document.body.innerHTML = markup;
  }, html);
  await page.waitForTimeout(500);
}