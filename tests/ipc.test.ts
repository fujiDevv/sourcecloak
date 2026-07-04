import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isContentScriptSender,
  isExtensionPageSender,
  isExtensionSender,
  isOffscreenSender,
  isServiceWorkerSender,
} from '../src/ipc';

const EXT_ID = 'test-extension-id';

function sender(patch: Partial<chrome.runtime.MessageSender>): chrome.runtime.MessageSender {
  return { id: EXT_ID, ...patch };
}

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: EXT_ID },
  });
});

describe('ipc sender validation', () => {
  it('rejects foreign extension senders', () => {
    expect(isExtensionSender(sender({ id: 'other-extension' }))).toBe(false);
  });

  it('accepts extension page senders', () => {
    const page = sender({ url: `chrome-extension://${EXT_ID}/options/options.html` });
    expect(isExtensionPageSender(page)).toBe(true);
    expect(isContentScriptSender(page)).toBe(false);
  });

  it('accepts content script senders', () => {
    const content = sender({
      tab: { id: 7 } as chrome.tabs.Tab,
      url: 'https://chat.example.com/',
    });
    expect(isContentScriptSender(content)).toBe(true);
    expect(isExtensionPageSender(content)).toBe(false);
  });

  it('accepts offscreen senders', () => {
    const offscreen = sender({ url: `chrome-extension://${EXT_ID}/offscreen.html` });
    expect(isOffscreenSender(offscreen)).toBe(true);
    expect(isServiceWorkerSender(offscreen)).toBe(false);
  });

  it('accepts service worker senders without html url', () => {
    const sw = sender({ url: `chrome-extension://${EXT_ID}/background.js` });
    expect(isServiceWorkerSender(sw)).toBe(true);
    expect(isExtensionPageSender(sw)).toBe(false);
  });
});