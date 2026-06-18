import type { SponsorSegment } from '@/types';
import { createLogger } from '@/utils/logger';
import type { ProviderContext, SegmentProvider } from './types';

const log = createLogger('provider:community');

/**
 * Backend interface for a future community-maintained segment database. The
 * shape mirrors the planned REST API:
 *
 *   GET  /segments/:videoId   → fetch crowd-sourced segments
 *   POST /segments            → contribute a result
 *
 * It is disabled by default (no `baseUrl`). When a backend exists, construct it
 * with a URL and register it ahead of the Gemini provider so cheap lookups win.
 */
export class CommunityProvider implements SegmentProvider {
  readonly id = 'community';
  readonly label = 'Community Database';

  constructor(private readonly baseUrl?: string) {}

  isAvailable(): boolean {
    return Boolean(this.baseUrl);
  }

  async getSegments(ctx: ProviderContext): Promise<SponsorSegment[]> {
    if (!this.baseUrl) return [];
    const url = `${this.baseUrl.replace(/\/$/, '')}/segments/${ctx.metadata.videoId}`;
    try {
      const res = await fetch(url, { signal: ctx.signal });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`Community API ${res.status}`);
      const data = (await res.json()) as { segments?: SponsorSegment[] };
      return (data.segments ?? []).map((s) => ({ ...s, source: this.id }));
    } catch (error) {
      log.warn('lookup failed', error);
      return [];
    }
  }

  /** Contribute a freshly analysed result back to the community database. */
  async contribute(
    videoId: string,
    segments: SponsorSegment[],
  ): Promise<void> {
    if (!this.baseUrl) return;
    const url = `${this.baseUrl.replace(/\/$/, '')}/segments`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, segments }),
      });
    } catch (error) {
      log.warn('contribute failed', error);
    }
  }
}
