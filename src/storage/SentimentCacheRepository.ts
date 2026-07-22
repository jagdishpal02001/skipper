import type { VideoSentiment } from '@/types';
import { createLogger } from '@/utils/logger';
import type { StorageArea } from './StorageArea';

const log = createLogger('sentiment-cache');

const KEY_PREFIX = 'skipper:sentiment:';
/** Comments shift slowly — a week keeps verdicts fresh without re-asking. */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Device-local cache of per-video sentiment verdicts, keyed by videoId with a
 * TTL. Same shape as {@link SegmentCacheRepository} so the storage discipline
 * stays uniform.
 */
export class SentimentCacheRepository {
  constructor(
    private readonly storage: StorageArea,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  private keyFor(videoId: string): string {
    return `${KEY_PREFIX}${videoId}`;
  }

  async get(videoId: string): Promise<VideoSentiment | null> {
    const entry = await this.storage.get<VideoSentiment>(this.keyFor(videoId));
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      log.debug('expired', videoId);
      await this.storage.remove(this.keyFor(videoId));
      return null;
    }
    return entry;
  }

  async set(sentiment: VideoSentiment): Promise<void> {
    await this.storage.set({ [this.keyFor(sentiment.videoId)]: sentiment });
  }

  /** Drop any entries past their TTL. Cheap housekeeping. */
  async pruneExpired(): Promise<number> {
    const all = await this.storage.keys();
    const keys = all.filter((k) => k.startsWith(KEY_PREFIX));
    if (!keys.length) return 0;
    const entries = await this.storage.getMany(keys);
    const expired = Object.entries(entries)
      .filter(
        ([, v]) => Date.now() - (v as VideoSentiment).createdAt > this.ttlMs,
      )
      .map(([key]) => key);
    if (expired.length) await this.storage.remove(expired);
    return expired.length;
  }
}
