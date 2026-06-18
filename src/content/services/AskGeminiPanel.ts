import type { AskGeminiDriver } from '@/providers';
import { createLogger } from '@/utils/logger';
import {
  extractTimestampSeconds,
  sliceTextAfterNthTimestamp,
} from '@/utils/youtube';

const log = createLogger('ask-gemini-panel');

/** How long to wait for the panel / input to appear after opening. */
const OPEN_TIMEOUT_MS = 8000;
/** How long to wait for the Send button to become enabled after typing. */
const SEND_ENABLE_TIMEOUT_MS = 1500;
/** Hard ceiling on waiting for the model's streamed reply. */
const ANSWER_TIMEOUT_MS = 45000;
/** Reply is considered complete once the panel text is unchanged this long. */
const ANSWER_STABLE_MS = 1600;
const POLL_MS = 150;

/**
 * Drives YouTube's built-in "Ask about this video" Gemini panel via the DOM:
 * opens it, types a prompt, submits, and reads back the streamed reply.
 *
 * Targets YouTube's current chat UI (`chatInputViewModel*` / `ytSpecButton*`
 * components) and is deliberately tag-agnostic — it anchors on the chat
 * textarea and climbs to the panel that holds the "Ask about this video"
 * header — so it survives the frequent renaming of YouTube's web components.
 *
 * UX care: it preserves the page scroll position across every interaction
 * (focusing the textarea and opening the panel both scroll the page otherwise)
 * and closes the panel again afterwards if it was the one that opened it.
 */
export class AskGeminiPanel implements AskGeminiDriver {
  readonly id = 'dom';

  isAvailable(): boolean {
    return Boolean(this.findChatInput() || this.findAskButton());
  }

  // videoId is unused — the panel always targets the current page's video.
  async ask(
    prompt: string,
    _videoId: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const releaseScrollLock = this.lockScroll();
    let opened = false;
    try {
      const { panel, opened: didOpen } = await this.openPanel(signal);
      opened = didOpen;

      const input = await this.waitFor(
        () => this.findChatInput(),
        OPEN_TIMEOUT_MS,
        signal,
        'chat input',
      );

      // Count timestamps already on screen (earlier Q&As) so we can isolate the
      // new reply afterwards.
      const baselineTokens = extractTimestampSeconds(
        panel.innerText ?? '',
      ).length;
      this.typeInto(input, prompt);
      await this.submit(panel, input, signal);

      return await this.readReply(panel, baselineTokens, signal);
    } finally {
      // Leave the page as we found it: close the panel only if we opened it.
      if (opened) this.closePanel();
      releaseScrollLock();
    }
  }

  // ---- opening ----------------------------------------------------------

  private async openPanel(
    signal?: AbortSignal,
  ): Promise<{ panel: HTMLElement; opened: boolean }> {
    // Already open? Reuse it — clicking "Ask" again would toggle it closed,
    // and we must not close a panel the user opened themselves.
    const existing = this.findPanelRoot();
    if (existing && this.findChatInput()) {
      return { panel: existing, opened: false };
    }

    // After SPA navigation the toolbar may not have re-rendered yet, so the
    // "Ask" button can be momentarily absent — wait for it rather than bailing.
    const button = await this.waitForOptional(
      () => this.findAskButton(),
      OPEN_TIMEOUT_MS,
      signal,
    );
    if (!button) throw new Error('Ask Gemini button not found on this page');
    log.debug('clicking Ask button');
    this.clickEl(button);

    const panel = await this.waitFor(
      () => this.findPanelRoot(),
      OPEN_TIMEOUT_MS,
      signal,
      'panel',
    );
    return { panel, opened: true };
  }

  private closePanel(): void {
    const panel = this.findPanelRoot();
    if (!panel) return;
    const close = panel.querySelector<HTMLElement>(
      'button[aria-label="Close" i], button[aria-label*="close" i]',
    );
    if (close) {
      log.debug('closing panel');
      this.clickEl(close);
    }
  }

  // ---- DOM lookups (the brittle bits, isolated) -------------------------

  /** The toolbar "Ask" button that opens the panel (aria-label="Ask"). */
  private findAskButton(): HTMLElement | null {
    const candidates = document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"]',
    );
    for (const el of candidates) {
      const aria = (el.getAttribute('aria-label') ?? '').trim().toLowerCase();
      const text = (el.textContent ?? '').trim().toLowerCase();
      if (
        (aria === 'ask' || aria === 'ask about this video' || text === 'ask') &&
        this.isVisible(el)
      ) {
        return el;
      }
    }
    return null;
  }

  /** The chat textarea (only present/visible when the panel is open). */
  private findChatInput(): HTMLTextAreaElement | null {
    const inputs = document.querySelectorAll<HTMLTextAreaElement>('textarea');
    for (const el of inputs) {
      const placeholder = (el.placeholder ?? '').toLowerCase();
      const isChat =
        el.classList.contains('chatInputViewModelChatInput') ||
        placeholder.includes('ask a question') ||
        Boolean(el.closest('.chatInputViewModelChatInputForm'));
      if (isChat && this.isVisible(el)) return el;
    }
    return null;
  }

  /**
   * The panel container that holds the conversation. Found by climbing from the
   * chat input to the ancestor that contains the "Ask about this video" header
   * — independent of YouTube's component tag names. Scoping reads to this node
   * keeps the video's chapter/description timestamps out of parsing.
   */
  private findPanelRoot(): HTMLElement | null {
    const input = this.findChatInput();
    if (!input) return null;
    let el: HTMLElement | null = input;
    for (let i = 0; i < 14 && el; i++) {
      if (
        el !== document.body &&
        /ask about this video/i.test(el.textContent ?? '')
      ) {
        return el;
      }
      el = el.parentElement;
    }
    // Fallback (e.g. localized header): a sensible ancestor above the input.
    return (
      input.closest<HTMLElement>(
        'ytd-engagement-panel-section-list-renderer',
      ) ??
      input.parentElement?.parentElement ??
      input.parentElement ??
      input
    );
  }

  /** The enabled Send button inside the panel (aria-label="Send"). */
  private findSendButton(panel: HTMLElement): HTMLElement | null {
    const direct = panel.querySelector<HTMLElement>(
      'button[aria-label="Send"]:not([disabled]):not([aria-disabled="true"])',
    );
    if (direct) return direct;
    for (const el of panel.querySelectorAll<HTMLElement>(
      'button, [role="button"]',
    )) {
      const aria = (el.getAttribute('aria-label') ?? '').toLowerCase();
      const disabled =
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true';
      if (!disabled && /send|submit/.test(aria)) return el;
    }
    return null;
  }

  // ---- input + submit ---------------------------------------------------

  private typeInto(input: HTMLTextAreaElement, text: string): void {
    // preventScroll stops the browser yanking the viewport to the textarea.
    input.focus({ preventScroll: true });
    input.select();

    // execCommand('insertText') fires the real beforeinput/input events that
    // YouTube's framework listens to (so the Send button enables). Fall back to
    // the native value setter if it's unavailable.
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch {
      inserted = false;
    }
    if (!inserted || input.value !== text) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setter?.call(input, text);
    }
    // Always fire input/change so the framework's value tracker updates and
    // enables the (initially disabled) Send button without delay.
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text,
      }),
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private async submit(
    panel: HTMLElement,
    input: HTMLTextAreaElement,
    signal?: AbortSignal,
  ): Promise<void> {
    // Wait for Send to enable now that the textarea has content.
    const send = await this.waitForOptional(
      () => this.findSendButton(panel),
      SEND_ENABLE_TIMEOUT_MS,
      signal,
    );
    if (send) {
      log.debug('clicking Send');
      this.clickEl(send);
      return;
    }
    // Fallback: press Enter in the textarea.
    log.debug('Send button not found; pressing Enter');
    for (const type of ['keydown', 'keypress', 'keyup'] as const) {
      input.dispatchEvent(
        new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
        }),
      );
    }
  }

  // ---- reading the reply ------------------------------------------------

  private async readReply(
    panel: HTMLElement,
    baselineTokens: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const deadline = Date.now() + ANSWER_TIMEOUT_MS;
    const initial = (panel.innerText ?? '').trim();
    let last = initial;
    let stableSince = Date.now();
    let changed = false;

    while (Date.now() < deadline) {
      this.throwIfAborted(signal);
      const text = (panel.innerText ?? '').trim();
      const grewTokens =
        extractTimestampSeconds(text).length > baselineTokens;

      if (text !== last) {
        last = text;
        stableSince = Date.now();
        if (text !== initial) changed = true;
      } else if (
        (changed || grewTokens) &&
        Date.now() - stableSince >= ANSWER_STABLE_MS
      ) {
        // The reply has finished streaming.
        return this.isolateReply(last, baselineTokens);
      }
      await this.delay(POLL_MS);
    }

    // Nothing ever streamed — treat as a failure so the caller can fall back
    // and we don't cache an empty result that would suppress future attempts.
    if (!changed) {
      throw new Error('Ask Gemini: no response from panel');
    }
    log.warn('reply timed out; parsing whatever streamed');
    return this.isolateReply(last, baselineTokens);
  }

  /**
   * Isolate the newest reply by dropping everything up to and including the
   * timestamps already on screen before we asked (earlier answers appear first
   * in the panel). Robust against YouTube's changing DOM class names.
   */
  private isolateReply(panelText: string, baselineTokens: number): string {
    return sliceTextAfterNthTimestamp(panelText, baselineTokens).trim();
  }

  // ---- helpers ----------------------------------------------------------

  /** Robust click for custom web components that ignore a bare .click(). */
  private clickEl(el: HTMLElement): void {
    const opts: MouseEventInit = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  /**
   * Prevent YouTube from scrolling the page while we drive the panel. We block
   * the usual cause (programmatic `scrollIntoView`) outright and re-pin the
   * window if anything else nudges it — preventing the jump rather than
   * reactively undoing it (which flickers). Returns a release function.
   */
  private lockScroll(): () => void {
    const saved = { x: window.scrollX, y: window.scrollY };
    const proto = Element.prototype;
    const originalScrollIntoView = proto.scrollIntoView;
    proto.scrollIntoView = function (): void {
      /* suppressed while the Ask panel is being driven */
    };
    const onScroll = (): void => {
      if (window.scrollX !== saved.x || window.scrollY !== saved.y) {
        window.scrollTo(saved.x, saved.y);
      }
    };
    window.addEventListener('scroll', onScroll, true);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      proto.scrollIntoView = originalScrollIntoView;
      window.removeEventListener('scroll', onScroll, true);
      window.scrollTo(saved.x, saved.y);
    };
  }

  private isVisible(el: HTMLElement): boolean {
    return el.offsetParent !== null || el.getClientRects().length > 0;
  }

  private async waitFor<T>(
    fn: () => T | null,
    timeoutMs: number,
    signal: AbortSignal | undefined,
    what: string,
  ): Promise<T> {
    const found = await this.waitForOptional(fn, timeoutMs, signal);
    if (found) return found;
    throw new Error(`Ask Gemini: timed out waiting for ${what}`);
  }

  private async waitForOptional<T>(
    fn: () => T | null,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      this.throwIfAborted(signal);
      const value = fn();
      if (value) return value;
      await this.delay(POLL_MS);
    }
    return null;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
