import type { SegmentType, SponsorSegment } from '@/types';
import { createLogger } from '@/utils/logger';
import { sha256Hex } from '@/utils/hash';

const log = createLogger('sponsorblock');

const API = 'https://sponsor.ajay.app/apiWe/skipSegments';

/**
 * SponsorBlock categories we consume, mapped onto Skipper's segment types.
 * Other SponsorBlock categories (interaction, music_offtopic, preview, …) are
 * intentionally ignored — they don't correspond to a user skip toggle.
 */
const CATEGORY_MAP: Record<string, SegmentType> = {
  sponsor: 'sponsor',
  selfpromo: 'self_promo',
  intro: 'intro',
  outro: 'outro',
};

interface SponsorBlockSegment {
  category: string;
  actionType: string;
  segment: [number, number];
}

interface SponsorBlockVideo {
  videoID: string;
  segments: SponsorBlockSegment[];
}

/**
 * Look up sponsor segments from SponsorBlock's free, public, login-free
 * community database — the reliable source that works for any visitor on any
 * popular video, no Google sign-in or YouTube AI feature required.
 *
 * Uses the privacy-preserving hash-prefix endpoint: only the first 4 hex chars
 * of the video ID's SHA-256 are sent, and we filter the (small) returned set to
 * our exact video locally, so the full watched video ID never leaves the device.
 *
 * Fails silently — any network/parse error is treated as a miss so the caller
 * cascades on to the next provider.
 */
export async function sponsorBlockLookup(
  videoId: string,
  signal?: AbortSignal,
): Promise<SponsorSegment[] | null> {
  try {
    const prefix = (await sha256Hex(videoId)).slice(0, 4);
    const categories = encodeURIComponent(JSON.stringify(Object.keys(CATEGORY_MAP)));
    const actionTypes = encodeURIComponent('["skip"]');
    const url = `${API}/${prefix}?categories=${categories}&actionTypes=${actionTypes}`;

    const res = await fetch(url, { signal });
    if (res.status === 404) {
      log.debug('miss', videoId);
      return null;
    }
    if (!res.ok) {
      log.warn(`lookup HTTP ${res.status}`);
      return null;
    }

    const videos = (await res.json()) as SponsorBlockVideo[];
    const match = videos.find((v) => v.videoID === videoId);
    const segments = match ? toSegments(match.segments) : [];
    if (segments.length === 0) {
      log.debug('miss', videoId);
      return null;
    }

    log.info('hit', videoId, `${segments.length} segments`);
    return segments;
  } catch (error) {
    log.warn('lookup failed', error);
    return null;
  }
}

function toSegments(raw: SponsorBlockSegment[]): SponsorSegment[] {
  const out: SponsorSegment[] = [];
  for (const s of raw) {
    if (s.actionType !== 'skip') continue;
    const type = CATEGORY_MAP[s.category];
    if (!type) continue;
    const [start, end] = s.segment;
    if (!(end > start)) continue;
    out.push({
      start,
      end,
      type,
      // Community-vetted; treat as high confidence so it clears the engine's
      // skip threshold. The segment is still gated by its per-category toggle.
      confidence: 0.9,
      source: 'sponsorblock',
    });
  }
  return out;
}
