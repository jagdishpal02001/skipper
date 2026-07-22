import type { VideoSentiment } from '@/types';
import { createLogger } from '@/utils/logger';

const log = createLogger('sentiment-badge');

const HOST_ID = 'skipper-sentiment-badge';

/** Colour the /10 rating by band: green (good), amber (mixed), red (poor). */
function ratingColor(rating: number): string {
  if (rating >= 7) return '#2ecc71';
  if (rating >= 4) return '#e0a82e';
  return '#e0506a';
}

const SPLIT = [
  { key: 'positivePct', label: 'Positive', color: '#2ecc71' },
  { key: 'neutralPct', label: 'Neutral', color: '#8b929e' },
  { key: 'negativePct', label: 'Negative', color: '#e0506a' },
] as const;

/**
 * The audience-rating badge rendered next to YouTube's like/dislike buttons.
 * Pure DOM in a shadow root (no React, no style leakage), mirroring
 * {@link TimelineMarkers}: it retries until the action bar exists and
 * re-attaches itself across SPA navigations.
 *
 * States: `showLoading` (auto-analysis running), `showRating` (verdict chip;
 * click opens a popover with the positive/negative split and summary),
 * `showPrompt` (a "✦ Rate" chip when auto-analysis wasn't possible — clicking
 * runs the full analysis via the supplied callback).
 */
export class SentimentBadge {
  private retryTimer: number | null = null;
  private root: ShadowRoot | null = null;
  private popoverOpen = false;
  private sentiment: VideoSentiment | null = null;
  private onPrompt: (() => void) | null = null;

  private readonly onDocClick = (e: Event): void => {
    // Close the popover when clicking anywhere outside our host.
    const host = document.getElementById(HOST_ID);
    if (this.popoverOpen && host && !e.composedPath().includes(host)) {
      this.popoverOpen = false;
      this.render();
    }
  };

  showLoading(): void {
    this.sentiment = null;
    this.onPrompt = null;
    this.mountAndRender();
  }

  showRating(sentiment: VideoSentiment): void {
    this.sentiment = sentiment;
    this.onPrompt = null;
    this.mountAndRender();
  }

  /** Show a click-to-analyze chip (auto-run unavailable or failed). */
  showPrompt(onClick: () => void): void {
    this.sentiment = null;
    this.onPrompt = onClick;
    this.mountAndRender();
  }

  clear(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    document.removeEventListener('click', this.onDocClick, true);
    document.getElementById(HOST_ID)?.remove();
    this.root = null;
    this.popoverOpen = false;
    this.sentiment = null;
    this.onPrompt = null;
  }

  // ---- mounting ---------------------------------------------------------

  private mountAndRender(attempt = 0): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    let host = document.getElementById(HOST_ID);
    // Re-attach if YouTube rebuilt the action bar (SPA navigation).
    if (host && !host.isConnected) {
      host.remove();
      host = null;
    }
    if (!host || !host.isConnected) {
      const anchor = this.findAnchor();
      if (!anchor) {
        // Action bar not rendered yet — retry for ~8s, then give up quietly.
        if (attempt < 16) {
          this.retryTimer = window.setTimeout(
            () => this.mountAndRender(attempt + 1),
            500,
          );
        } else {
          log.debug('anchor not found; badge not shown');
        }
        return;
      }
      host = document.createElement('span');
      host.id = HOST_ID;
      host.style.cssText = 'display:inline-flex;align-items:center;';
      anchor.insertAdjacentElement('afterend', host);
      this.root = host.attachShadow({ mode: 'open' });
      document.addEventListener('click', this.onDocClick, true);
    } else if (!this.root) {
      this.root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    }
    this.render();
  }

  /** The like/dislike control we insert ourselves after. */
  private findAnchor(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(
        '#actions segmented-like-dislike-button-view-model, ' +
          '#top-level-buttons-computed segmented-like-dislike-button-view-model, ' +
          'ytd-watch-metadata segmented-like-dislike-button-view-model',
      ) ??
      document.querySelector<HTMLElement>(
        '#top-level-buttons-computed ytd-segmented-like-dislike-button-renderer',
      )
    );
  }

  // ---- rendering --------------------------------------------------------

  private render(): void {
    const root = this.root;
    if (!root) return;

    const s = this.sentiment;

    if (s) {
      const color = ratingColor(s.rating);
      root.innerHTML = `
        ${this.styles()}
        <span style="position:relative;display:inline-flex;">
          <button id="chip" class="chip${this.popoverOpen ? ' open' : ''}" style="--c:${color};color:${color};"
                  title="Audience rating from top comments — click for details">
            <span class="star">✦</span>
            <span>${s.rating.toFixed(1)}<span class="denom">/10</span></span>
          </button>
          ${this.popoverOpen ? this.popoverHtml(s, color) : ''}
        </span>`;
      root.getElementById('chip')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.popoverOpen = !this.popoverOpen;
        this.render();
      });
      return;
    }

    if (this.onPrompt) {
      root.innerHTML = `
        ${this.styles()}
        <button id="chip" class="chip" style="--c:#f1f3f5;color:#f1f3f5;"
                title="Ask Gemini what viewers think of this video">
          <span class="star">✦</span><span>Rate</span>
        </button>`;
      root.getElementById('chip')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPrompt?.();
      });
      return;
    }

    // Loading state — subtle pulsing chip.
    root.innerHTML = `
      ${this.styles()}
      <span class="chip loading" title="Skipper is reading the comments…">
        <span class="star spin">✦</span><span>…</span>
      </span>`;
  }

  /** Shared stylesheet for the shadow root (re-emitted on every render). */
  private styles(): string {
    return `<style>
      .chip {
        display: inline-flex; align-items: center; gap: 5px;
        margin-left: 8px; padding: 0 14px; height: 36px;
        border-radius: 18px; border: none; position: relative;
        background: rgba(255, 255, 255, 0.1);
        font-family: Roboto, Arial, sans-serif; font-size: 13px; font-weight: 600;
        cursor: pointer; user-select: none; white-space: nowrap;
        transition: background .15s ease, box-shadow .15s ease, transform .1s ease;
      }
      /* Mirror YouTube's own action buttons: lighten on hover + a soft ring
         tinted with the rating colour. */
      .chip:hover, .chip.open {
        background: rgba(255, 255, 255, 0.2);
        box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c) 45%, transparent);
      }
      .chip:active { transform: scale(0.95); }
      .chip.loading {
        cursor: default; color: #aab2bd;
        animation: skipper-pulse 1.4s ease-in-out infinite;
      }
      .chip.loading:hover { background: rgba(255,255,255,0.1); box-shadow: none; }
      .star { font-size: 14px; transition: transform .25s ease; }
      .chip:hover .star { transform: rotate(72deg) scale(1.15); }
      .star.spin { animation: skipper-spin 1.6s linear infinite; }
      .denom { opacity: 0.6; font-weight: 400; }
      .pop { animation: skipper-pop .18s ease; transform-origin: top right; }
      .pop .fill { animation: skipper-grow .45s ease; transform-origin: left; }
      @keyframes skipper-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
      @keyframes skipper-spin { to { transform: rotate(360deg); } }
      @keyframes skipper-pop {
        from { opacity: 0; transform: translateY(-6px) scale(0.97); }
        to { opacity: 1; transform: none; }
      }
      @keyframes skipper-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    </style>`;
  }

  private popoverHtml(s: VideoSentiment, color: string): string {
    const bar = SPLIT.map(
      (p) =>
        `<div class="fill" style="width:${s[p.key]}%;background:${p.color};height:100%;"></div>`,
    ).join('');
    const legend = SPLIT.map(
      (p) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;">
           <span style="width:8px;height:8px;border-radius:2px;background:${p.color};display:inline-block;"></span>
           <span style="color:#aab2bd;">${p.label} ${s[p.key]}%</span>
         </span>`,
    ).join('');

    return `
      <div class="pop" style="position:absolute;top:44px;right:0;z-index:99999;width:300px;padding:14px;border-radius:12px;background:rgba(18,20,24,0.97);border:1px solid rgba(255,255,255,0.12);box-shadow:0 8px 24px rgba(0,0,0,0.5);font-family:Roboto,Arial,sans-serif;cursor:default;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;font-weight:700;color:${color};">${s.rating.toFixed(1)}/10</span>
          <span style="font-size:11px;color:#8b929e;">audience rating · ${s.sampleSize} comments</span>
        </div>
        <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:#2a2f3a;margin-bottom:8px;">${bar}</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;">${legend}</div>
        <div style="font-size:12px;line-height:1.5;color:#d7dbe0;">${this.escape(s.summary)}</div>
        <div style="margin-top:8px;font-size:10px;color:#6b7280;">Skipper · AI verdict from top comments — may be imperfect</div>
      </div>`;
  }

  private escape(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
