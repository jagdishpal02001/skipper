/**
 * Thin promise-based abstraction over a chrome.storage area. Exists so the
 * repositories below depend on an interface rather than the global chrome
 * object directly — which keeps them testable and swappable.
 */
export interface StorageArea {
  get<T>(key: string): Promise<T | undefined>;
  getMany(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  keys(): Promise<string[]>;
  bytesInUse(keys?: string[]): Promise<number>;
  onChanged(
    listener: (changes: Record<string, chrome.storage.StorageChange>) => void,
  ): () => void;
}

class ChromeStorageArea implements StorageArea {
  constructor(private readonly area: chrome.storage.StorageArea) {}

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.area.get(key);
    return result[key] as T | undefined;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    return this.area.get(keys);
  }

  async set(items: Record<string, unknown>): Promise<void> {
    await this.area.set(items);
  }

  async remove(keys: string | string[]): Promise<void> {
    await this.area.remove(keys);
  }

  async keys(): Promise<string[]> {
    const all = await this.area.get(null);
    return Object.keys(all);
  }

  async bytesInUse(keys?: string[]): Promise<number> {
    return this.area.getBytesInUse(keys ?? null);
  }

  onChanged(
    listener: (changes: Record<string, chrome.storage.StorageChange>) => void,
  ): () => void {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      // chrome.storage.onChanged is global across areas; only forward ours.
      if (this.matchesArea(areaName)) listener(changes);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }

  private matchesArea(areaName: string): boolean {
    return (
      (areaName === 'local' && this.area === chrome.storage.local) ||
      (areaName === 'sync' && this.area === chrome.storage.sync)
    );
  }
}

export const localStorageArea: StorageArea = new ChromeStorageArea(
  chrome.storage.local,
);

export const syncStorageArea: StorageArea = new ChromeStorageArea(
  chrome.storage.sync,
);
