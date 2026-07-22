import { localStorageArea, syncStorageArea } from './StorageArea';
import { SegmentCacheRepository } from './SegmentCacheRepository';
import { SettingsRepository } from './SettingsRepository';
import { ErrorLogRepository } from './ErrorLogRepository';
import { UsageStatsRepository } from './UsageStatsRepository';
import { SentimentCacheRepository } from './SentimentCacheRepository';

export * from './StorageArea';
export { SegmentCacheRepository } from './SegmentCacheRepository';
export { SettingsRepository } from './SettingsRepository';
export { ErrorLogRepository } from './ErrorLogRepository';
export { UsageStatsRepository } from './UsageStatsRepository';
export { SentimentCacheRepository } from './SentimentCacheRepository';

/**
 * Shared repository singletons. Cache lives in `local` (large, device-local);
 * settings live in `sync` (small, follow the user across devices).
 */
export const segmentCache = new SegmentCacheRepository(localStorageArea);
export const settingsRepository = new SettingsRepository(syncStorageArea);
export const errorLogRepository = new ErrorLogRepository(localStorageArea);
export const usageStats = new UsageStatsRepository(localStorageArea);
export const sentimentCache = new SentimentCacheRepository(localStorageArea);
