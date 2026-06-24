import type { SponsorSegment } from '@/types';
import { CATEGORY_FOR_TYPE } from '@/types';
import { formatTimestamp } from '@/utils/time';
import { createLogger } from '@/utils/logger';

const log = createLogger('timeline');

const OVERLAY_ID = 'skipper-timeline-markers';

/** Colour per skip category, so the bar communicates *why* a region is marked. */
const COLOR: Record<string, string> = {
  sponsor: 'rgba(46, 204, 113, 0.65)', // emerald green
  self_promo: 'rgba(168, 85, 247, 0.65)', // amethyst purple
  intro: 'rgba(59, 130, 246, 0.65)', // peter river blue
  outro: 'rgba(59, 130, 246, 0.65)',
};

const COLOR_ACTIVE: Record<string, string> = {
  sponsor: 'rgba(46, 204, 113, 0.95)',
  self_promo: 'rgba(168, 85, 247, 0.95)',
  intro: 'rgba(59, 130, 246, 0.95)',
  outro: 'rgba(59, 130, 246, 0.95)',
};

/** Human-readable description shown on hover, telling the user what the region is. */
const LABEL: Record<string, string> = {
  sponsor: 'Sponsored segment',
  self_promo: 'Self-promotion',
  intro: 'Intro',
  outro: 'Outro',
};

/**
 * Paints sponsor segments onto YouTube's progress bar as coloured overlays, so
 * the user can see which parts of the video are flagged (à la SponsorBlock).
 * Hovering a flagged region shows a tooltip explaining what it is (e.g. that the
 * part is sponsored) and highlights the marker.
 *
 * Pure DOM, no React: it injects one absolutely-positioned, click-through
 * overlay into the player's progress bar and positions child markers by
 * percentage of the total duration, so they stay correct as the bar resizes.
 */
export class TimelineMarkers {
  private retryTimer: number | null = null;
  private tooltip: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private hoverBar: HTMLElement | null = null;
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
    this.attachHover(bar);

    for (const seg of segments) {
      const left = (seg.start / durationSeconds) * 100;
      const width = ((seg.end - seg.start) / durationSeconds) * 100;
      if (width <= 0) continue;

      const category = CATEGORY_FOR_TYPE[seg.type] || 'sponsor';
      const marker = document.createElement('div');
      marker.className = 'skipper-marker';
      marker.dataset.start = seg.start.toString();
      marker.dataset.end = seg.end.toString();
      marker.dataset.type = category;

      marker.style.cssText = [
        'position:absolute',
        'top:0',
        'height:100%',
        `left:${left}%`,
        `width:${Math.max(width, 0.2)}%`,
        `background:${COLOR[category] ?? COLOR.sponsor}`,
        'opacity:0.65',
        'transition:opacity 0.15s ease, background 0.15s ease, transform 0.15s ease',
      ].join(';');
      // Native tooltip as a fallback for the custom one.
      marker.title = `Skipper · ${LABEL[category] ?? LABEL.sponsor} (${formatTimestamp(
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
    this.segments = [];
    document.getElementById(OVERLAY_ID)?.remove();
    this.overlay = null;
  }

  // ---- hover -------------------------------------------------------------

  /**
   * Wire mouse tracking on the progress bar. Uses stable bound handlers and
   * reads live state (`this.overlay` / `this.segments`) so it keeps working
   * across SPA navigations — and re-binds if YouTube swaps the bar element.
   */
  private attachHover(bar: HTMLElement): void {
    if (this.hoverBar === bar) return;
    if (this.hoverBar) {
      this.hoverBar.removeEventListener('mousemove', this.onMouseMove);
      this.hoverBar.removeEventListener('mouseleave', this.onMouseLeave);
    }
    this.hoverBar = bar;
    bar.addEventListener('mousemove', this.onMouseMove);
    bar.addEventListener('mouseleave', this.onMouseLeave);
  }

  private onMouseMove = (e: MouseEvent): void => {
    const bar = this.hoverBar;
    if (!bar || !this.durationSeconds || this.segments.length === 0) {
      this.hideTooltip();
      this.resetMarkers();
      return;
    }

    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const hoverTime = ((e.clientX - rect.left) / rect.width) * this.durationSeconds;
    const seg = this.segments.find(
      (s) => hoverTime >= s.start && hoverTime <= s.end,
    );

    if (seg) {
      const category = CATEGORY_FOR_TYPE[seg.type] || 'sponsor';
      this.showTooltip(e.clientX, rect.top, LABEL[category] ?? 'Sponsored segment');
      this.highlightActiveMarker(seg);
    } else {
      this.hideTooltip();
      this.resetMarkers();
    }
  };

  private onMouseLeave = (): void => {
    this.hideTooltip();
    this.resetMarkers();
  };

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
        'white-space:nowrap',
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

  // ---- markers -----------------------------------------------------------

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
    this.overlay = overlay;
    return overlay;
  }

  private highlightActiveMarker(activeSeg: SponsorSegment): void {
    if (!this.overlay) return;
    const markers = this.overlay.querySelectorAll<HTMLElement>('.skipper-marker');
    markers.forEach((m) => {
      const type = m.dataset.type || 'sponsor';
      const start = parseFloat(m.dataset.start || '0');
      const end = parseFloat(m.dataset.end || '0');
      const isActive =
        Math.abs(start - activeSeg.start) < 0.1 &&
        Math.abs(end - activeSeg.end) < 0.1;
      m.style.background = (isActive
        ? COLOR_ACTIVE[type] ?? COLOR_ACTIVE.sponsor
        : COLOR[type] ?? COLOR.sponsor) as string;
      m.style.opacity = isActive ? '1' : '0.65';
    });
  }

  private resetMarkers(): void {
    if (!this.overlay) return;
    const markers = this.overlay.querySelectorAll<HTMLElement>('.skipper-marker');
    markers.forEach((m) => {
      const type = m.dataset.type || 'sponsor';
      m.style.background = (COLOR[type] ?? COLOR.sponsor) as string;
      m.style.opacity = '0.65';
    });
  }

  private findProgressBar(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.ytp-progress-list');
  }
}
