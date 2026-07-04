import { extensionApi } from './platform';

export function isExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  return Boolean(sender.id && sender.id === extensionApi.runtime.id);
}

/** Popup, options Policy Console — not a content script on a web page */
export function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  if (!isExtensionSender(sender)) return false;
  const prefix = `chrome-extension://${sender.id}/`;
  if (!sender.url?.startsWith(prefix)) return false;
  return sender.url.includes('.html');
}

/** Content script in a tab (page URL, not chrome-extension://) */
export function isContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  if (!isExtensionSender(sender)) return false;
  if (!sender.tab?.id) return false;
  const prefix = `chrome-extension://${sender.id}/`;
  if (sender.url?.startsWith(prefix)) return false;
  return true;
}

/** Offscreen ONNX document */
export function isOffscreenSender(sender: chrome.runtime.MessageSender): boolean {
  if (!isExtensionSender(sender)) return false;
  return Boolean(sender.url?.includes('offscreen.html'));
}

/** Background service worker (not extension HTML pages or content scripts) */
export function isServiceWorkerSender(sender: chrome.runtime.MessageSender): boolean {
  if (!isExtensionSender(sender)) return false;
  if (sender.tab?.id) return false;
  if (!sender.url) return true;
  const prefix = `chrome-extension://${sender.id}/`;
  if (!sender.url.startsWith(prefix)) return false;
  return !sender.url.includes('.html');
}