import { test, expect } from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('SourceCloak Interception', () => {
  test('blocks credential on paste', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // Navigate to a real page so content script is injected
    await page.goto('https://example.com');
    await page.evaluate(() => {
      document.body.innerHTML = '<textarea id="target" style="width: 100%; height: 200px;"></textarea>';
    });

    // Give the content script a moment to attach
    await page.waitForTimeout(500);

    const textarea = page.locator('#target');
    await textarea.focus();

    // Paste an AWS key
    const awsKey = `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\naws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`;

    await page.evaluate(async (key) => {
      await navigator.clipboard.writeText(key);
    }, awsKey);

    const isMac = process.platform === 'darwin';
    await textarea.press(isMac ? 'Meta+v' : 'Control+v');

    // Wait for the overlay to appear
    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).toBeVisible();

    // Check that the warning text is present
    await expect(overlay).toContainText('Transmission Blocked');
    await expect(overlay).toContainText('AWS');

    // Check that the textarea value is empty
    await expect(textarea).toHaveValue('');
  });

  test('allows benign paste', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('https://example.com');
    await page.evaluate(() => {
      document.body.innerHTML = '<textarea id="target" style="width: 100%; height: 200px;"></textarea>';
    });
    
    // Give the content script a moment to attach
    await page.waitForTimeout(500);

    const textarea = page.locator('#target');
    await textarea.focus();

    const benignText = 'Hello, can you help me write a Python script?';
    
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, benignText);

    const isMac = process.platform === 'darwin';
    await textarea.press(isMac ? 'Meta+v' : 'Control+v');

    // No overlay should appear
    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).not.toBeVisible();

    // The text SHOULD be in the textarea
    await expect(textarea).toHaveValue(benignText);
  });
});
