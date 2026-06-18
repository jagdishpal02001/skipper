import type { SponsorSegment } from '@/types';
import { createLogger } from '@/utils/logger';
import type { ProviderContext, SegmentProvider } from './types';

const log = createLogger('registry');

export interface ProviderRunResult {
  providerId: string;
  segments: SponsorSegment[];
}

/**
 * Registry and coordinator for the chain of segment providers.
 * Providers are evaluated in registration order, and the first provider
 * that successfully returns segments is used.
 */
export class ProviderRegistry {
  private readonly providers: SegmentProvider[] = [];

  register(provider: SegmentProvider): this {
    this.providers.push(provider);
    return this;
  }

  list(): readonly SegmentProvider[] {
    return this.providers;
  }

  /**
   * Run providers in order until one returns a non-empty segment list.
   * Throws only if every available provider errored.
   */
  async resolve(ctx: ProviderContext): Promise<ProviderRunResult> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      let available = false;
      try {
        available = await provider.isAvailable(ctx);
      } catch (error) {
        log.warn(`${provider.id} availability check failed`, error);
      }
      if (!available) {
        log.debug(`skip ${provider.id} (unavailable)`);
        continue;
      }

      try {
        log.info(`trying ${provider.id}`);
        const segments = await provider.getSegments(ctx);
        if (segments.length > 0) {
          return { providerId: provider.id, segments };
        }
        log.debug(`${provider.id} returned no segments`);
      } catch (error) {
        log.warn(`${provider.id} failed`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      // Surface the first real failure so the user sees a useful message.
      throw errors[0];
    }

    // No provider errored, but none found segments either — a valid result.
    return { providerId: 'none', segments: [] };
  }
}
