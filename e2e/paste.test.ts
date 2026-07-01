import { test, expect } from './fixtures';
import {
  AWS_CREDENTIAL_PASTE,
  BENIGN_PASTE,
  injectFixture,
  pasteFromClipboard,
} from './helpers';

test.describe.configure({ mode: 'serial' });

const TEXTAREA_FIXTURE =
  '<textarea id="target" style="width: 100%; height: 200px;"></textarea>';

const MONACO_FIXTURE = `
<div class="monaco-editor" style="border: 1px solid #ccc; min-height: 200px;">
  <div class="monaco-scrollable-element">
    <div id="monaco-target" contenteditable="true" class="inputarea" style="min-height: 200px; padding: 8px;"></div>
  </div>
</div>`;

const CODEMIRROR_FIXTURE = `
<div class="cm-editor" style="border: 1px solid #ccc; min-height: 200px;">
  <div class="cm-scroller">
    <div id="cm-target" contenteditable="true" class="cm-content" style="min-height: 200px; padding: 8px;"></div>
  </div>
</div>`;

test.describe('SourceCloak Interception', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('blocks credential on textarea paste', async ({ page }) => {
    await injectFixture(page, TEXTAREA_FIXTURE);

    const textarea = page.locator('#target');
    await pasteFromClipboard(page, textarea, AWS_CREDENTIAL_PASTE);

    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Transmission Blocked');
    await expect(overlay).toContainText('AWS');
    await expect(textarea).toHaveValue('');
  });

  test('allows benign textarea paste', async ({ page }) => {
    await injectFixture(page, TEXTAREA_FIXTURE);

    const textarea = page.locator('#target');
    await pasteFromClipboard(page, textarea, BENIGN_PASTE);

    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).not.toBeVisible();
    await expect(textarea).toHaveValue(BENIGN_PASTE);
  });

  test('blocks credential on Monaco contenteditable paste', async ({ page }) => {
    await injectFixture(page, MONACO_FIXTURE);

    const editor = page.locator('#monaco-target');
    await pasteFromClipboard(page, editor, AWS_CREDENTIAL_PASTE);

    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Transmission Blocked');
    await expect(editor).toHaveText('');
  });

  test('allows benign Monaco contenteditable paste', async ({ page }) => {
    await injectFixture(page, MONACO_FIXTURE);

    const editor = page.locator('#monaco-target');
    await pasteFromClipboard(page, editor, BENIGN_PASTE);

    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).not.toBeVisible();
    await expect(editor).toContainText(BENIGN_PASTE);
  });

  test('blocks credential on CodeMirror contenteditable paste', async ({ page }) => {
    await injectFixture(page, CODEMIRROR_FIXTURE);

    const editor = page.locator('#cm-target');
    await pasteFromClipboard(page, editor, AWS_CREDENTIAL_PASTE);

    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Transmission Blocked');
    await expect(editor).toHaveText('');
  });

  test('allows benign CodeMirror contenteditable paste', async ({ page }) => {
    await injectFixture(page, CODEMIRROR_FIXTURE);

    const editor = page.locator('#cm-target');
    await pasteFromClipboard(page, editor, BENIGN_PASTE);

    const overlay = page.locator('#sourcecloak-warning');
    await expect(overlay).not.toBeVisible();
    await expect(editor).toContainText(BENIGN_PASTE);
  });
});