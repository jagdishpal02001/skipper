import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import type { StorageArea } from './StorageArea';

const SETTINGS_KEY = 'skipper:settings';

/**
 * Repository for user settings. Merges persisted values over defaults so new
 * settings added in future versions get sensible fallbacks.
 */
export class SettingsRepository {
  constructor(private readonly storage: StorageArea) {}

  async get(): Promise<Settings> {
    const stored = await this.storage.get<Partial<Settings>>(SETTINGS_KEY);
    return this.merge(stored);
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const next: Settings = {
      ...current,
      ...patch,
      skip: { ...current.skip, ...(patch.skip ?? {}) },
    };
    await this.storage.set({ [SETTINGS_KEY]: next });
    return next;
  }

  /** Subscribe to settings changes. Returns an unsubscribe function. */
  subscribe(listener: (settings: Settings) => void): () => void {
    return this.storage.onChanged((changes) => {
      const change = changes[SETTINGS_KEY];
      if (change) listener(this.merge(change.newValue as Partial<Settings>));
    });
  }

  private merge(stored: Partial<Settings> | undefined): Settings {
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      skip: { ...DEFAULT_SETTINGS.skip, ...(stored?.skip ?? {}) },
    };
  }
}
