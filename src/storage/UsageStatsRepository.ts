import { createLogger } from '@/utils/logger';
import type {
  ChannelTotal,
  DailyUsage,
  UsageDelta,
  UsageSummary,
  UsageTotals,
} from '@/types';
import type { StorageArea } from './StorageArea';

const log = createLogger('usage-stats');

const KEY_PREFIX = 'skipper:stats:';
/** Buckets older than this are pruned as cheap housekeeping. */
const DEFAULT_RETENTION_DAYS = 90;
/** How many channels the dashboard shows. */
const TOP_CHANNELS = 10;

/**
 * Repository for persistent, device-local usage analytics. Each day of usage is
 * a single key (`skipper:stats:<YYYY-MM-DD>`) holding a {@link DailyUsage}
 * bucket; deltas are applied read-modify-write to *today's* bucket only, so the
 * write set stays tiny regardless of history length.
 *
 * Backed by an injected StorageArea (local) so the mechanism stays swappable and
 * testable, mirroring {@link SegmentCacheRepository}.
 */
export class UsageStatsRepository {
  constructor(
    private readonly storage: StorageArea,
    private readonly retentionDays: number = DEFAULT_RETENTION_DAYS,
  ) {}

  private keyFor(date: string): string {
    return `${KEY_PREFIX}${date}`;
  }

  /** Local calendar day as `YYYY-MM-DD` (not UTC — matches the user's clock). */
  private today(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private empty(date: string): DailyUsage {
    return {
      date,
      timeSavedSeconds: 0,
      skipCount: 0,
      watchSeconds: 0,
      browseSeconds: 0,
      shortsSeconds: 0,
      channels: {},
    };
  }

  /** Apply an additive delta to today's bucket. */
  async addDelta(delta: UsageDelta): Promise<void> {
    const date = this.today();
    const key = this.keyFor(date);
    const bucket = (await this.storage.get<DailyUsage>(key)) ?? this.empty(date);

    bucket.timeSavedSeconds += delta.timeSavedSeconds ?? 0;
    bucket.skipCount += delta.skipCount ?? 0;
    bucket.watchSeconds += delta.watchSeconds ?? 0;
    bucket.browseSeconds += delta.browseSeconds ?? 0;
    bucket.shortsSeconds += delta.shortsSeconds ?? 0;

    if (delta.channelSeconds && (delta.channelId || delta.channelName)) {
      const id = delta.channelId || delta.channelName!;
      const existing = bucket.channels[id];
      bucket.channels[id] = {
        seconds: (existing?.seconds ?? 0) + delta.channelSeconds,
        name: delta.channelName || existing?.name || id,
      };
    }

    await this.storage.set({ [key]: bucket });
  }

  /**
   * Aggregate totals for the last `days` calendar days (inclusive of today),
   * plus all-time totals and the top channels within that range. `days <= 0`
   * makes the range cover all time.
   */
  async summary(days: number): Promise<UsageSummary> {
    const all = await this.allBuckets();
    const cutoff = days > 0 ? this.cutoffDate(days) : null;
    const inRange = cutoff ? all.filter((b) => b.date >= cutoff) : all;

    return {
      days: days > 0 ? days : 0,
      range: this.totals(inRange),
      allTime: this.totals(all),
      topChannels: this.topChannels(inRange),
    };
  }

  /** Remove every stored usage bucket. */
  async clear(): Promise<void> {
    const keys = await this.statsKeys();
    if (keys.length) await this.storage.remove(keys);
  }

  /** Drop buckets older than the retention window. */
  async pruneOld(): Promise<number> {
    const cutoff = this.cutoffDate(this.retentionDays);
    const keys = await this.statsKeys();
    const expired = keys.filter((k) => k.slice(KEY_PREFIX.length) < cutoff);
    if (expired.length) {
      await this.storage.remove(expired);
      log.debug(`pruned ${expired.length} old buckets`);
    }
    return expired.length;
  }

  // ---- internals --------------------------------------------------------

  private totals(buckets: DailyUsage[]): UsageTotals {
    const t: UsageTotals = {
      timeSavedSeconds: 0,
      skipCount: 0,
      watchSeconds: 0,
      browseSeconds: 0,
      shortsSeconds: 0,
      totalSeconds: 0,
    };
    for (const b of buckets) {
      t.timeSavedSeconds += b.timeSavedSeconds;
      t.skipCount += b.skipCount;
      t.watchSeconds += b.watchSeconds;
      t.browseSeconds += b.browseSeconds;
      t.shortsSeconds += b.shortsSeconds;
    }
    t.totalSeconds = t.watchSeconds + t.browseSeconds + t.shortsSeconds;
    return t;
  }

  private topChannels(buckets: DailyUsage[]): ChannelTotal[] {
    const merged = new Map<string, ChannelTotal>();
    for (const b of buckets) {
      for (const [id, usage] of Object.entries(b.channels)) {
        const existing = merged.get(id);
        if (existing) {
          existing.seconds += usage.seconds;
          if (usage.name) existing.name = usage.name;
        } else {
          merged.set(id, { id, name: usage.name || id, seconds: usage.seconds });
        }
      }
    }
    return [...merged.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, TOP_CHANNELS);
  }

  /** The earliest `YYYY-MM-DD` still inside a window of `days` days. */
  private cutoffDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async allBuckets(): Promise<DailyUsage[]> {
    const keys = await this.statsKeys();
    if (!keys.length) return [];
    const entries = await this.storage.getMany(keys);
    return Object.values(entries) as DailyUsage[];
  }

  private async statsKeys(): Promise<string[]> {
    const all = await this.storage.keys();
    return all.filter((k) => k.startsWith(KEY_PREFIX));
  }
}
