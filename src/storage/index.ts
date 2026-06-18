import { localStorageArea, syncStorageArea } from './StorageArea';
import { SegmentCacheRepository } from './SegmentCacheRepository';
import { SettingsRepository } from './SettingsRepository';
import { ErrorLogRepository } from './ErrorLogRepository';

export * from './StorageArea';
export { SegmentCacheRepository } from './SegmentCacheRepository';
export { SettingsRepository } from './SettingsRepository';
export { ErrorLogRepository } from './ErrorLogRepository';

/**
 * Shared repository singletons. Cache lives in `local` (large, device-local);
 * settings live in `sync` (small, follow the user across devices).
 */
export const segmentCache = new SegmentCacheRepository(localStorageArea);
export const settingsRepository = new SettingsRepository(syncStorageArea);
export const errorLogRepository = new ErrorLogRepository(localStorageArea);
