import type { AnalysisResult } from '@/types';
import { createLogger } from '@/utils/logger';
import type { CacheInfo } from '@/types';
import type { StorageArea } from './StorageArea';

const log = createLogger('cache');

const KEY_PREFIX = 'skipper:cache:';
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Repository for cached per-video analysis results. Implements a simple
 * key/value cache with a TTL, backed by an injected StorageArea so the storage
 * mechanism can be swapped without touching callers.
 */
export class SegmentCacheRepository {
  constructor(
    private readonly storage: StorageArea,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  private keyFor(videoId: string): string {
    return `${KEY_PREFIX}${videoId}`;
  }

  /** Returns a cached result if present and not expired, otherwise null. */
  async get(videoId: string): Promise<AnalysisResult | null> {
    const entry = await this.storage.get<AnalysisResult>(this.keyFor(videoId));
    if (!entry) return null;
    if (this.isExpired(entry)) {
      log.debug('cache expired', videoId);
      await this.remove(videoId);
      return null;
    }
    return entry;
  }

  async set(result: AnalysisResult): Promise<void> {
    await this.storage.set({ [this.keyFor(result.videoId)]: result });
    log.debug('cached', result.videoId, `${result.segments.length} segments`);
  }

  async remove(videoId: string): Promise<void> {
    await this.storage.remove(this.keyFor(videoId));
  }

  /** Remove every cached entry. */
  async clear(): Promise<void> {
    const keys = await this.cacheKeys();
    if (keys.length) await this.storage.remove(keys);
  }

  /** Drop any entries that are past their TTL. Cheap housekeeping. */
  async pruneExpired(): Promise<number> {
    const keys = await this.cacheKeys();
    if (!keys.length) return 0;
    const entries = await this.storage.getMany(keys);
    const expired = Object.entries(entries)
      .filter(([, value]) => this.isExpired(value as AnalysisResult))
      .map(([key]) => key);
    if (expired.length) await this.storage.remove(expired);
    return expired.length;
  }

  async info(): Promise<CacheInfo> {
    const keys = await this.cacheKeys();
    const approxBytes = keys.length ? await this.storage.bytesInUse(keys) : 0;
    return { entries: keys.length, approxBytes };
  }

  private isExpired(entry: AnalysisResult): boolean {
    return Date.now() - entry.createdAt > this.ttlMs;
  }

  private async cacheKeys(): Promise<string[]> {
    const all = await this.storage.keys();
    return all.filter((k) => k.startsWith(KEY_PREFIX));
  }
}
