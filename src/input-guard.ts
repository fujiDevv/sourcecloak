import type { ClassificationResult, ShieldSettings } from './types';
import { debounce } from './throttle';
import { requestBackgroundClassification } from './ai';
import { classifyWithRules } from './classifier';
import { showBlockWarning } from './warning-overlay';

type GuardedElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

const GUARDED_SELECTOR = 'textarea, input[type="text"], input[type="search"], input[type="url"], input[type="email"], input:not([type]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
const elementPreviousValues = new WeakMap<Element, string>();

export interface InputGuardOptions {
  settings: ShieldSettings;
  onBlock?: (result: ClassificationResult, element: GuardedElement, eventType: 'paste' | 'input') => void;
}

export class InputGuard {
  private observer: MutationObserver | null = null;
  private settings: ShieldSettings;
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

  updateSettings(settings: ShieldSettings): void {
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

    pasteEvent.preventDefault();
    pasteEvent.stopImmediatePropagation();

    const result = await this.classifyPayload(clipboardText);
    if (result.blocked) {
      this.purgeElement(element);
      if (this.settings.showWarningOverlay) {
        showBlockWarning(result.matches, this.settings.organizationName);
      }
      this.onBlock?.(result, element, 'paste');
      return;
    }

    this.insertText(element, clipboardText);
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

    const currentValue = this.readElementValue(element);
    const previousValue = elementPreviousValues.get(element) ?? '';
    if (currentValue === previousValue) return;

    const delta = currentValue.length > previousValue.length
      ? currentValue.slice(previousValue.length)
      : currentValue;

    const result = await this.classifyPayload(delta.length >= 12 ? currentValue : delta);
    if (!result.blocked) {
      elementPreviousValues.set(element, currentValue);
      return;
    }

    this.restoreOrPurge(element, previousValue);
    if (this.settings.showWarningOverlay) {
      showBlockWarning(result.matches, this.settings.organizationName);
    }
    this.onBlock?.(result, element, 'input');
  }, 400);

  private async classifyPayload(text: string): Promise<ClassificationResult> {
    const remote = await requestBackgroundClassification(text);
    if (remote) return remote;
    return classifyWithRules(text, this.settings);
  }

  private readElementValue(element: GuardedElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    return element.textContent ?? '';
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

  private insertText(element: GuardedElement, text: string): void {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || (element instanceof HTMLElement && element.isContentEditable)) {
      element.focus();
      if (document.execCommand('insertText', false, text)) {
        elementPreviousValues.set(element, this.readElementValue(element));
        return;
      }
    }
    
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? element.value.length;
      const nextValue = `${element.value.slice(0, start)}${text}${element.value.slice(end)}`;
      
      this.setNativeValue(element, nextValue);
      const caret = start + text.length;
      try {
        element.setSelectionRange(caret, caret);
      } catch (e) {
        // Some input types don't support setSelectionRange
      }
      
      elementPreviousValues.set(element, nextValue);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    element.textContent = `${element.textContent ?? ''}${text}`;
    elementPreviousValues.set(element, element.textContent ?? '');
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private purgeElement(element: GuardedElement): void {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      this.setNativeValue(element, '');
    } else {
      element.textContent = '';
    }
    elementPreviousValues.set(element, '');
    element.dispatchEvent(new Event('input', { bubbles: true }));
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
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}