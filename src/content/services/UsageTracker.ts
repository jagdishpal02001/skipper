import type { YouTubePlayer } from '@/services';
import type { UsageDelta } from '@/types';
import { sendToBackground } from '@/utils/messaging';
import { createLogger } from '@/utils/logger';

const log = createLogger('usage-tracker');

/** Heartbeat granularity — one accounted second per tick. */
const TICK_MS = 1000;
/** How often accumulated time is flushed to the background store. */
const FLUSH_MS = 15000;
/**
 * While *not* watching a video, only count time as "browsing" if the user has
 * interacted within this window — so a YouTube tab left open and untouched
 * doesn't silently inflate the numbers.
 */
const IDLE_MS = 60000;

interface PendingUsage {
  watch: number;
  browse: number;
  shorts: number;
  /** Watch seconds attributed per channel (keyed by channel name). */
  channels: Map<string, number>;
}

/**
 * Measures how the user spends time on YouTube and periodically flushes it to
 * the persistent usage store. It's the only place that classifies time, keeping
 * the accounting rules in one spot:
 *
 *   • Only *active* time counts — the tab must be visible and focused.
 *   • **Watching** (`/watch` with playback running) and **Shorts** (`/shorts`
 *     with playback running) count purely on playback, since an engaged viewer
 *     needn't touch the mouse.
 *   • Everything else on YouTube (home, search, a paused video, …) counts as
 *     **browsing**, but only while the user has interacted within {@link IDLE_MS}.
 *
 * Watch time is attributed to the channel supplied via {@link setChannel}.
 */
export class UsageTracker {
  private tickTimer: number | null = null;
  private flushTimer: number | null = null;
  private lastInteraction = Date.now();
  private channel: string | null = null;

  private pending: PendingUsage = this.emptyPending();

  private readonly onInteract = () => {
    this.lastInteraction = Date.now();
  };
  private readonly onHidden = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };
  private readonly onPageHide = () => {
    void this.flush();
  };

  constructor(private readonly player: YouTubePlayer) {}

  /** Tell the tracker which channel the current watch-page video belongs to. */
  setChannel(channelName: string | null): void {
    this.channel = channelName?.trim() || null;
  }

  start(): void {
    this.stop();
    for (const evt of ['mousemove', 'keydown', 'scroll', 'click', 'pointerdown']) {
      window.addEventListener(evt, this.onInteract, { passive: true });
    }
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('pagehide', this.onPageHide);

    this.tickTimer = window.setInterval(() => this.tick(), TICK_MS);
    this.flushTimer = window.setInterval(() => void this.flush(), FLUSH_MS);
    log.debug('usage tracker started');
  }

  stop(): void {
    if (this.tickTimer !== null) clearInterval(this.tickTimer);
    if (this.flushTimer !== null) clearInterval(this.flushTimer);
    this.tickTimer = null;
    this.flushTimer = null;
    for (const evt of ['mousemove', 'keydown', 'scroll', 'click', 'pointerdown']) {
      window.removeEventListener(evt, this.onInteract);
    }
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('pagehide', this.onPageHide);
    void this.flush();
  }

  // ---- accounting -------------------------------------------------------

  private tick(): void {
    // Baseline: only the visible, focused tab accrues any time.
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

    const path = location.pathname;
    const playing = this.player.available && !this.player.paused;

    if (path.startsWith('/shorts')) {
      if (playing) this.pending.shorts += 1;
      else this.countBrowse();
      return;
    }

    if (path.startsWith('/watch')) {
      if (playing) {
        this.pending.watch += 1;
        if (this.channel) {
          this.pending.channels.set(
            this.channel,
            (this.pending.channels.get(this.channel) ?? 0) + 1,
          );
        }
      } else {
        this.countBrowse();
      }
      return;
    }

    // Home, search, channel pages, library, etc.
    this.countBrowse();
  }

  /** Browsing only counts while the user is genuinely active. */
  private countBrowse(): void {
    if (Date.now() - this.lastInteraction < IDLE_MS) this.pending.browse += 1;
  }

  private async flush(): Promise<void> {
    const p = this.pending;
    if (!p.watch && !p.browse && !p.shorts && p.channels.size === 0) return;
    this.pending = this.emptyPending();

    const base: UsageDelta = {};
    if (p.watch) base.watchSeconds = p.watch;
    if (p.browse) base.browseSeconds = p.browse;
    if (p.shorts) base.shortsSeconds = p.shorts;

    try {
      if (base.watchSeconds || base.browseSeconds || base.shortsSeconds) {
        await sendToBackground({ type: 'RECORD_USAGE', delta: base });
      }
      for (const [name, seconds] of p.channels) {
        await sendToBackground({
          type: 'RECORD_USAGE',
          delta: { channelId: name, channelName: name, channelSeconds: seconds },
        });
      }
    } catch (error) {
      // Never let a failed flush throw into the heartbeat; drop the window.
      log.warn('usage flush failed', error);
    }
  }

  private emptyPending(): PendingUsage {
    return { watch: 0, browse: 0, shorts: 0, channels: new Map() };
  }
}
