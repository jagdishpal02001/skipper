import type { GrowthState } from '@/types';
import { DEFAULT_GROWTH_STATE } from '@/types';
import { milestoneFor } from '@/utils/growth';
import type { StorageArea } from './StorageArea';

const KEY = 'skipper:growth';

/**
 * Repository for the growth prompts' state ({@link GrowthState}). Lives in
 * `local` like the usage stats it's derived from — it describes this device.
 */
export class GrowthRepository {
  constructor(private readonly storage: StorageArea) {}

  async get(): Promise<GrowthState> {
    const stored = await this.storage.get<Partial<GrowthState>>(KEY);
    return { ...DEFAULT_GROWTH_STATE, ...stored };
  }

  async update(patch: Partial<GrowthState>): Promise<GrowthState> {
    const next: GrowthState = { ...(await this.get()), ...patch };
    await this.storage.set({ [KEY]: next });
    return next;
  }

  /**
   * Record that all-time time saved is now `savedSeconds`. Returns true the
   * first time a new milestone is reached, so each is celebrated exactly once.
   */
  async claimMilestone(savedSeconds: number): Promise<boolean> {
    const reached = milestoneFor(savedSeconds);
    const { celebratedMilestone } = await this.get();
    if (reached <= celebratedMilestone) return false;
    await this.update({ celebratedMilestone: reached });
    return true;
  }
}
