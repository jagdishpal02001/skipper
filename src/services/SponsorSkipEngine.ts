import type { Settings, SponsorSegment } from '@/types';
import { CATEGORY_FOR_TYPE } from '@/types';
import { createLogger } from '@/utils/logger';
import type { YouTubePlayer } from './YouTubePlayer';

const log = createLogger('skip-engine');

export interface SkipEvent {
  segment: SponsorSegment;
  from: number;
  to: number;
}

export interface SkipStats {
  skippedCount: number;
  timeSavedSeconds: number;
}

type SkipListener = (event: SkipEvent) => void;
type StatsListener = (stats: SkipStats) => void;

/** How often we sample the playback position. */
const POLL_MS = 250;
/** Don't skip the same segment twice within this window (anti-loop guard). */
const SKIP_DEBOUNCE_MS = 1500;

/**
 * Watches playback position and jumps past promotional segments.
 *
 * Monitoring uses a lightweight polling loop (re-resolving the <video> each
 * tick) rather than a one-shot `timeupdate` listener — YouTube swaps the video
 * element across SPA navigations and may not have created it when the content
 * script boots, which would otherwise leave skipping silently dead.
 *
 * "Soft skip": if the user *manually seeks into* a flagged segment, that
 * segment is suppressed so they can watch it. It re-enables once they seek to a
 * non-flagged part of the video.
 */
export class SponsorSkipEngine {
  private segments: SponsorSegment[] = [];
  private active: SponsorSegment[] = [];
  private settings: Settings | null = null;
  private enabled = true;

  private timer: number | null = null;
  private lastTime: number | null = null;
  private readonly lastSkipAt = new Map<SponsorSegment, number>();
  /** Segments the user deliberately seeked into — don't auto-skip these. */
  private readonly suppressed = new Set<SponsorSegment>();

  private stats: SkipStats = { skippedCount: 0, timeSavedSeconds: 0 };
  private readonly skipListeners = new Set<SkipListener>();
  private readonly statsListeners = new Set<StatsListener>();

  constructor(private readonly player: YouTubePlayer) {}

  setSettings(settings: Settings): void {
    this.settings = settings;
    this.recomputeActive();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Load a fresh set of segments (e.g. after analysis) and reset stats. */
  load(segments: SponsorSegment[]): void {
    this.segments = segments;
    this.lastSkipAt.clear();
    this.suppressed.clear();
    this.lastTime = null;
    this.stats = { skippedCount: 0, timeSavedSeconds: 0 };
    this.emitStats();
    this.recomputeActive();
  }

  start(): void {
    this.stop();
    this.timer = window.setInterval(() => this.tick(), POLL_MS);
    log.debug('engine started');
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStats(): SkipStats {
    return { ...this.stats };
  }

  onSkip(listener: SkipListener): () => void {
    this.skipListeners.add(listener);
    return () => this.skipListeners.delete(listener);
  }

  onStats(listener: StatsListener): () => void {
    this.statsListeners.add(listener);
    return () => this.statsListeners.delete(listener);
  }

  /** The segments currently eligible for skipping (respecting settings). */
  getActiveSegments(): SponsorSegment[] {
    return [...this.active];
  }

  private tick(): void {
    if (!this.enabled || !this.settings?.enabled) return;
    // Never auto-skip a livestream — seeking is meaningless / disruptive.
    if (this.player.isLive || !this.player.available) return;

    const time = this.player.currentTime;
    this.detectManualSeek(time);
    this.lastTime = time;

    const segment = this.findContaining(time, false);
    if (!segment) return;

    const now = Date.now();
    if (now - (this.lastSkipAt.get(segment) ?? 0) < SKIP_DEBOUNCE_MS) return;

    const target = segment.end + 0.1;
    const saved = Math.max(0, segment.end - time);
    this.lastSkipAt.set(segment, now);

    this.player.currentTime = target;
    // Record the jump as our own so the next tick doesn't read it as a user seek.
    this.lastTime = target;

    this.stats = {
      skippedCount: this.stats.skippedCount + 1,
      timeSavedSeconds: this.stats.timeSavedSeconds + saved,
    };
    log.info(`skipped ${segment.type} ${segment.start}→${segment.end}`);
    this.emitSkip({ segment, from: time, to: target });
    this.emitStats();
  }

  /**
   * Detect a discontinuity that isn't normal playback (or our own skip). If the
   * user landed inside a flagged segment, suppress it; if they landed outside
   * all segments, clear suppressions so skipping re-engages.
   */
  private detectManualSeek(time: number): void {
    if (this.lastTime === null) return;
    const rate = this.player.playbackRate || 1;
    // Allowable forward movement between polls during normal playback.
    const maxNormalDelta = (POLL_MS / 1000) * rate * 2 + 0.6;
    if (Math.abs(time - this.lastTime) <= maxNormalDelta) return;

    const landed = this.findContaining(time, true);
    if (landed) {
      this.suppressed.add(landed);
      log.debug(`soft-skip: user entered ${landed.start}→${landed.end}`);
    } else if (this.suppressed.size) {
      this.suppressed.clear();
      log.debug('soft-skip: suppressions cleared');
    }
  }

  private findContaining(
    time: number,
    includeSuppressed: boolean,
  ): SponsorSegment | null {
    for (const s of this.active) {
      if (!includeSuppressed && this.suppressed.has(s)) continue;
      // Small lead-out so we don't fight a user sitting on the boundary.
      if (time >= s.start && time < s.end - 0.25) return s;
    }
    return null;
  }

  private recomputeActive(): void {
    const settings = this.settings;
    if (!settings) {
      this.active = [];
      return;
    }
    this.active = this.segments.filter((s) => {
      if (s.confidence < 0.7) return false;
      return settings.skip[CATEGORY_FOR_TYPE[s.type]];
    });
    log.debug(`${this.active.length}/${this.segments.length} segments active`);
  }

  private emitSkip(event: SkipEvent): void {
    for (const l of this.skipListeners) l(event);
  }

  private emitStats(): void {
    for (const l of this.statsListeners) l(this.getStats());
  }
}
