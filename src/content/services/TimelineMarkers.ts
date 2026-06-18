import type { SponsorSegment } from '@/types';
import { CATEGORY_FOR_TYPE } from '@/types';
import { formatTimestamp } from '@/utils/time';
import { createLogger } from '@/utils/logger';

const log = createLogger('timeline');

const OVERLAY_ID = 'skipper-timeline-markers';

/** Colour per skip category, so the bar communicates *why* a region is marked. */
const COLOR: Record<string, string> = {
  sponsor: 'rgba(34, 197, 94, 0.85)', // green (was amber)
  self_promo: 'rgba(167, 139, 250, 0.85)', // violet
  intro: 'rgba(96, 165, 250, 0.85)', // blue
  outro: 'rgba(96, 165, 250, 0.85)',
};

/**
 * Paints sponsor segments onto YouTube's progress bar as coloured overlays, so
 * the user can see which parts of the video are flagged (à la SponsorBlock).
 *
 * Pure DOM, no React: it injects one absolutely-positioned, click-through
 * overlay into the player's progress bar and positions child markers by
 * percentage of the total duration, so they stay correct as the bar resizes.
 */
export class TimelineMarkers {
  private retryTimer: number | null = null;
  private tooltip: HTMLElement | null = null;
  private segments: SponsorSegment[] = [];
  private durationSeconds = 0;

  render(segments: SponsorSegment[], durationSeconds: number, attempt = 0): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.segments = segments;
    this.durationSeconds = durationSeconds;

    if (!durationSeconds || durationSeconds <= 0) {
      this.clear();
      return;
    }
    const bar = this.findProgressBar();
    if (!bar) {
      // The player chrome may not be in the DOM yet (e.g. early cache hit).
      if (attempt < 10) {
        this.retryTimer = window.setTimeout(
          () => this.render(segments, durationSeconds, attempt + 1),
          500,
        );
      }
      return;
    }

    const overlay = this.ensureOverlay(bar);
    overlay.replaceChildren();

    // Attach hover listener to the progress bar if not already present
    if (!bar.dataset.skipperHoverAttached) {
      bar.dataset.skipperHoverAttached = 'true';
      bar.addEventListener('mousemove', (e) => {
        if (!this.durationSeconds || this.segments.length === 0) {
          this.hideTooltip();
          return;
        }

        const rect = bar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const hoverTime = pct * this.durationSeconds;

        const activeSeg = this.segments.find(
          (s) => hoverTime >= s.start && hoverTime <= s.end,
        );

        if (activeSeg) {
          const category = CATEGORY_FOR_TYPE[activeSeg.type] || 'sponsor';
          const label = category === 'sponsor' ? 'Sponsor' : category.replace('_', ' ');
          this.showTooltip(e.clientX, rect.top, label);
        } else {
          this.hideTooltip();
        }
      });

      bar.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    }

    for (const seg of segments) {
      const left = (seg.start / durationSeconds) * 100;
      const width = ((seg.end - seg.start) / durationSeconds) * 100;
      if (width <= 0) continue;

      const marker = document.createElement('div');
      marker.style.cssText = [
        'position:absolute',
        'top:0',
        'height:100%',
        `left:${left}%`,
        `width:${Math.max(width, 0.2)}%`,
        `background:${COLOR[CATEGORY_FOR_TYPE[seg.type]] ?? COLOR.sponsor}`,
        'border-radius:1px',
      ].join(';');
      marker.title = `Skipper: ${seg.type.replace('_', ' ')} (${formatTimestamp(
        seg.start,
      )} → ${formatTimestamp(seg.end)})`;
      overlay.appendChild(marker);
    }
    log.debug(`painted ${segments.length} markers`);
  }

  clear(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.hideTooltip();
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private showTooltip(x: number, y: number, text: string): void {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'skipper-timeline-tooltip';
      this.tooltip.style.cssText = [
        'position:fixed',
        'z-index:99999',
        'padding:6px 10px',
        'background:rgba(20, 20, 20, 0.95)',
        'backdrop-filter:blur(4px)',
        '-webkit-backdrop-filter:blur(4px)',
        'color:#22c55e', // green text
        'font-family:Roboto, Arial, sans-serif',
        'font-size:12px',
        'font-weight:bold',
        'border-radius:4px',
        'border:1px solid rgba(34, 197, 94, 0.4)',
        'pointer-events:none',
        'transform:translate(-50%, -100%)',
        'transition:opacity 0.15s ease',
        'opacity:0',
        'box-shadow:0 4px 12px rgba(0,0,0,0.5)',
      ].join(';');
      document.body.appendChild(this.tooltip);
    }
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y - 8}px`;
    this.tooltip.style.opacity = '1';
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style.opacity = '0';
    }
  }

  private ensureOverlay(bar: HTMLElement): HTMLElement {
    let overlay = document.getElementById(OVERLAY_ID);
    // Re-attach if YouTube rebuilt the bar (SPA navigation).
    if (overlay && overlay.parentElement !== bar) {
      overlay.remove();
      overlay = null;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.cssText = [
        'position:absolute',
        'top:0',
        'left:0',
        'width:100%',
        'height:100%',
        'pointer-events:none', // never block seeking
        'z-index:30',
      ].join(';');
      bar.appendChild(overlay);
    }
    return overlay;
  }

  private findProgressBar(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      '.ytp-progress-bar-padding ~ .ytp-progress-bar, .ytp-progress-bar',
    );
  }
}
