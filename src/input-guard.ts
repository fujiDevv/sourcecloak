import type { ClassificationResult, SourceCloakSettings } from './types';
import { debounce } from './throttle';
import { requestBackgroundClassification } from './ai';
import { classifyWithRules } from './classifier';
import { showBlockWarning } from './warning-overlay';
import { isHostnameInScope } from './utils';

type GuardedElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

const GUARDED_SELECTOR = 'textarea, input[type="text"], input[type="search"], input[type="url"], input[type="email"], input:not([type]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
const elementPreviousValues = new WeakMap<Element, string>();
const pasteInFlight = new WeakSet<Element>();
const programmaticInput = new WeakSet<Element>();

export interface InputGuardOptions {
  settings: SourceCloakSettings;
  onBlock?: (result: ClassificationResult, element: GuardedElement, eventType: 'paste' | 'input') => void;
}

export class InputGuard {
  private observer: MutationObserver | null = null;
  private settings: SourceCloakSettings;
  private onBlock?: InputGuardOptions['onBlock'];
  private isOrphaned = false;
  private attachedElementsList = new Set<GuardedElement>();

  constructor(options: InputGuardOptions) {
    this.settings = options.settings;
    this.onBlock = options.onBlock;
  }

  start(): void {
    if (this.isOrphaned) return;
    this.scanAndAttach(document);
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) this.scanAndAttach(node);
        });
      }
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  updateSettings(settings: SourceCloakSettings): void {
    this.settings = settings;
  }

  destroy(): void {
    this.isOrphaned = true;
    this.observer?.disconnect();
    this.observer = null;
    for (const element of this.attachedElementsList) {
      element.removeEventListener('paste', this.handlePaste, true);
      element.removeEventListener('beforeinput', this.handleBeforeInput, true);
      element.removeEventListener('input', this.handleInput, true);
    }
    this.attachedElementsList.clear();
  }

  private scanAndAttach(root: ParentNode): void {
    if (this.isOrphaned || !this.settings.enabled) return;

    const elements = root.querySelectorAll<GuardedElement>(GUARDED_SELECTOR);
    elements.forEach((element) => this.attachToElement(element));

    if (root instanceof HTMLElement && root.matches(GUARDED_SELECTOR)) {
      this.attachToElement(root);
    }
  }

  private attachToElement(element: GuardedElement): void {
    if (this.attachedElementsList.has(element) || !this.isElementEligible(element)) return;
    this.attachedElementsList.add(element);
    elementPreviousValues.set(element, this.readElementValue(element));

    element.addEventListener('paste', this.handlePaste, true);
    element.addEventListener('beforeinput', this.handleBeforeInput, true);
    element.addEventListener('input', this.handleInput, true);
  }

  private isElementEligible(element: GuardedElement): boolean {
    if (element instanceof HTMLInputElement) {
      const type = (element.type || 'text').toLowerCase();
      if (!['text', 'search', 'url', 'email', ''].includes(type)) return false;
      if (element.readOnly || element.disabled) return false;
    }
    if (element instanceof HTMLTextAreaElement && (element.readOnly || element.disabled)) return false;
    if (element instanceof HTMLElement && element.isContentEditable) {
      if ((element as HTMLElement).getAttribute('aria-disabled') === 'true') return false;
    }
    return true;
  }

  private handlePaste = async (event: Event): Promise<void> => {
    if (!this.settings.enabled || !this.settings.blockPaste) return;

    const pasteEvent = event as ClipboardEvent;
    const element = pasteEvent.target as GuardedElement | null;
    if (!element) return;

    const clipboardText = pasteEvent.clipboardData?.getData('text/plain') ?? '';
    if (!clipboardText.trim()) return;

    if (!isHostnameInScope(window.location.hostname, this.settings)) {
      return;
    }

    // Synchronous Tier 1 (Rules) for instant credential blocks
    const syncResult = classifyWithRules(clipboardText, this.settings);
    if (syncResult.blocked) {
      pasteEvent.preventDefault();
      pasteEvent.stopImmediatePropagation();

      this.purgeAdvancedEditorSafely(element);
      if (this.settings.showWarningOverlay) {
        showBlockWarning(syncResult.matches, this.settings.organizationName);
      }
      this.onBlock?.(syncResult, element, 'paste');
      return;
    }

    // Support for Monaco/CodeMirror advanced editors:
    // For benign/async path, we DO NOT preventDefault. We let the browser or editor 
    // natively insert the text to keep its Virtual DOM in sync.
    elementPreviousValues.set(element, this.readElementValue(element));
    pasteInFlight.add(element);

    try {
      const result = await this.classifyPayload(clipboardText, 'paste', element.tagName.toLowerCase());
      if (result.blocked) {
        this.purgeAdvancedEditorSafely(element);
        if (this.settings.showWarningOverlay) {
          showBlockWarning(result.matches, this.settings.organizationName);
        }
        // Audit/stats recorded by background classify-payload handler.
        return;
      }

      elementPreviousValues.set(element, this.readElementValue(element));
    } finally {
      pasteInFlight.delete(element);
    }
  };

  private handleBeforeInput = (event: Event): void => {
    if (!this.settings.enabled || !this.settings.blockInput) return;
    const beforeInput = event as InputEvent;
    const element = beforeInput.target as GuardedElement | null;
    if (!element || beforeInput.inputType === 'insertFromPaste') return;
    elementPreviousValues.set(element, this.readElementValue(element));
  };

  private handleInput = debounce(async (event: Event) => {
    if (!this.settings.enabled || !this.settings.blockInput) return;

    const element = event.target as GuardedElement | null;
    if (!element) return;

    if (pasteInFlight.has(element)) return;
    if (programmaticInput.has(element)) {
      programmaticInput.delete(element);
      return;
    }
    if (event instanceof InputEvent && event.inputType === 'insertFromPaste') return;

    const currentValue = this.readElementValue(element);
    const previousValue = elementPreviousValues.get(element) ?? '';
    if (currentValue === previousValue) return;

    const delta = currentValue.length > previousValue.length
      ? currentValue.slice(previousValue.length)
      : currentValue;

    const result = await this.classifyPayload(delta.length >= 12 ? currentValue : delta, 'input', element.tagName.toLowerCase());
    if (!result.blocked) {
      elementPreviousValues.set(element, currentValue);
      return;
    }

    this.restoreOrPurge(element, previousValue);
    if (this.settings.showWarningOverlay) {
      showBlockWarning(result.matches, this.settings.organizationName);
    }
  }, 400);

  private async classifyPayload(text: string, eventType: 'paste' | 'input' = 'paste', elementTag = 'unknown'): Promise<ClassificationResult> {
    const remote = await requestBackgroundClassification(text, eventType, elementTag);
    if (remote) return remote;
    return classifyWithRules(text, this.settings);
  }

  private readElementValue(element: GuardedElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    if (element instanceof HTMLElement && element.isContentEditable) {
      return element.innerText || element.textContent || '';
    }
    return '';
  }

  private purgeAdvancedEditorSafely(element: GuardedElement): void {
    const isAdvancedEditor = !!element.closest('.monaco-editor, .CodeMirror, .cm-editor');
    let purged = false;

    if (isAdvancedEditor) {
      try {
        purged = document.execCommand('undo');
      } catch (e) {
        purged = false;
      }
    }

    if (!purged) {
      this.purgeElement(element);
    }
  }

  private setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const proto = element instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }
  }

  private purgeElement(element: GuardedElement): void {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      this.setNativeValue(element, '');
    } else {
      element.textContent = '';
    }
    elementPreviousValues.set(element, '');
    this.dispatchGuardedInput(element);
  }

  private restoreOrPurge(element: GuardedElement, previousValue: string): void {
    let start: number | null = null;
    let end: number | null = null;

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      start = element.selectionStart;
      end = element.selectionEnd;
      this.setNativeValue(element, previousValue);
      
      if (start !== null && end !== null) {
        try {
          element.setSelectionRange(start, end);
        } catch (e) {
          // Ignore if input type doesn't support it
        }
      }
    } else {
      element.textContent = previousValue;
    }
    
    elementPreviousValues.set(element, previousValue);
    this.dispatchGuardedInput(element);
  }

  private dispatchGuardedInput(element: GuardedElement): void {
    programmaticInput.add(element);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}