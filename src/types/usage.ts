/**
 * Persistent, device-local usage analytics. Bucketed per calendar day (local
 * time) so the dashboard can show today / last-N-days / all-time without the
 * store growing without bound. Written only by the background worker.
 */

/** Watch time attributed to a single channel within a day. */
export interface ChannelUsage {
  seconds: number;
  name: string;
}

/** One day's worth of accumulated usage, keyed by `YYYY-MM-DD` (local). */
export interface DailyUsage {
  date: string;
  /** Seconds of playback saved by auto-skipping (feature 1). */
  timeSavedSeconds: number;
  /** Number of segments skipped. */
  skipCount: number;
  /** Active seconds spent watching regular (non-Shorts) videos (feature 2). */
  watchSeconds: number;
  /** Active seconds on YouTube while not watching anything (feature 3). */
  browseSeconds: number;
  /** Active seconds spent watching Shorts (feature 4). */
  shortsSeconds: number;
  /** Per-channel watch time, keyed by channel id (or name when id is absent). */
  channels: Record<string, ChannelUsage>;
}

/**
 * An additive change applied to today's bucket. Every field is optional; only
 * the ones present are incremented. `channelSeconds` is attributed to the
 * `channelId`/`channelName` pair when supplied.
 */
export interface UsageDelta {
  timeSavedSeconds?: number;
  skipCount?: number;
  watchSeconds?: number;
  browseSeconds?: number;
  shortsSeconds?: number;
  channelId?: string;
  channelName?: string;
  channelSeconds?: number;
}

/** A channel entry in the aggregated top-channels list. */
export interface ChannelTotal {
  id: string;
  name: string;
  seconds: number;
}

/** Aggregated totals over a set of daily buckets. */
export interface UsageTotals {
  timeSavedSeconds: number;
  skipCount: number;
  watchSeconds: number;
  browseSeconds: number;
  shortsSeconds: number;
  /** watch + browse + shorts — total active time on YouTube. */
  totalSeconds: number;
}

/**
 * The payload returned to the dashboard/popup: totals for a bounded range plus
 * all-time totals, and the top channels within the requested range.
 */
export interface UsageSummary {
  /** Number of days the `range` totals cover (0 = all time). */
  days: number;
  range: UsageTotals;
  allTime: UsageTotals;
  topChannels: ChannelTotal[];
}
