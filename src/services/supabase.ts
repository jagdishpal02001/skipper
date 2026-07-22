import type { SponsorSegment, VideoSentiment } from '@/types';
import { createLogger } from '@/utils/logger';
import { sha256Hex } from '@/utils/hash';

const log = createLogger('supabase');

// ---- Supabase config ----
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

const TABLE = 'segments';
const SENTIMENT_TABLE = 'sentiment';
const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
const REST_URL = `${cleanUrl}/rest/v1/${TABLE}`;
const SENTIMENT_REST_URL = `${cleanUrl}/rest/v1/${SENTIMENT_TABLE}`;

/** Shared verdicts older than this are ignored — comments drift over time. */
const SENTIMENT_MAX_AGE_DAYS = 14;

const headers = (): Record<string, string> => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
});

export interface SupabaseSegmentRow {
  /** SHA-256 hash of the YouTube video ID (the raw ID is never transmitted). */
  video_id: string;
  duration: number;
  segments: SponsorSegment[];
  provider: string | null;
  created_at: string;
}

/**
 * Look up cached segments for a video by its composite key (videoId + duration).
 * The raw video ID is SHA-256 hashed before it is sent, so the exact ID of the
 * video being watched never leaves the device.
 * Returns the segments array if found, null otherwise.
 * Fails silently — a network error just means "cache miss".
 */
export async function supabaseLookup(
  videoId: string,
  duration: number,
): Promise<SponsorSegment[] | null> {
  try {
    const videoHash = await sha256Hex(videoId);
    const url = `${REST_URL}?video_id=eq.${videoHash}&duration=eq.${duration}&select=segments`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      log.warn(`lookup HTTP ${res.status}`);
      return null;
    }

    const rows = (await res.json()) as Pick<SupabaseSegmentRow, 'segments'>[];
    if (rows.length === 0) {
      log.debug('miss', videoId);
      return null;
    }
    const row = rows[0];
    if (!row) {
      log.debug('miss', videoId);
      return null;
    }

    log.info('hit', videoId, `${row.segments.length} segments`);
    return row.segments;
  } catch (error) {
    log.warn('lookup failed (network)', error);
    return null;
  }
}

/**
 * Store (upsert) segments for a video. Uses Supabase's `on_conflict` to update
 * existing rows if the same videoId + duration is inserted again.
 * Fails silently — we never want a storage failure to break the user flow.
 */
export async function supabaseStore(
  videoId: string,
  duration: number,
  segments: SponsorSegment[],
  provider?: string,
): Promise<boolean> {
  try {
    const body = {
      video_id: await sha256Hex(videoId),
      duration,
      segments,
      provider: provider ?? null,
    };

    const res = await fetch(`${REST_URL}?on_conflict=video_id,duration`, {
      method: 'POST',
      headers: {
        ...headers(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      log.warn(`store HTTP ${res.status}`, await res.text());
      return false;
    }

    log.info('stored', videoId, `${segments.length} segments`);
    return true;
  } catch (error) {
    log.warn('store failed (network)', error);
    return false;
  }
}

// ---- sentiment (shared audience verdicts) -------------------------------

interface SupabaseSentimentRow {
  /** SHA-256 hash of the YouTube video ID (the raw ID is never transmitted). */
  video_id: string;
  rating: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  summary: string;
  sample_size: number;
  created_at: string;
}

/**
 * Look up a shared sentiment verdict for a video. Rows older than
 * {@link SENTIMENT_MAX_AGE_DAYS} are treated as stale and ignored so a video
 * whose reception shifted gets re-analyzed. Same privacy model as segments:
 * only the SHA-256 hash of the video ID leaves the device.
 * Fails silently — a network error just means "miss".
 */
export async function supabaseSentimentLookup(
  videoId: string,
): Promise<VideoSentiment | null> {
  try {
    const videoHash = await sha256Hex(videoId);
    const cutoff = new Date(
      Date.now() - SENTIMENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const url =
      `${SENTIMENT_REST_URL}?video_id=eq.${videoHash}` +
      `&created_at=gte.${encodeURIComponent(cutoff)}&select=*`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      log.warn(`sentiment lookup HTTP ${res.status}`);
      return null;
    }

    const rows = (await res.json()) as SupabaseSentimentRow[];
    const row = rows[0];
    if (!row) {
      log.debug('sentiment miss', videoId);
      return null;
    }

    log.info('sentiment hit', videoId);
    return {
      videoId,
      rating: row.rating,
      positivePct: row.positive_pct,
      negativePct: row.negative_pct,
      neutralPct: row.neutral_pct,
      summary: row.summary,
      sampleSize: row.sample_size,
      createdAt: new Date(row.created_at).getTime(),
    };
  } catch (error) {
    log.warn('sentiment lookup failed (network)', error);
    return null;
  }
}

/**
 * Share (upsert) a sentiment verdict so other users get it without asking
 * Gemini. Fails silently — sharing must never break the user flow.
 */
export async function supabaseSentimentStore(
  sentiment: VideoSentiment,
): Promise<boolean> {
  try {
    const body = {
      video_id: await sha256Hex(sentiment.videoId),
      rating: sentiment.rating,
      positive_pct: sentiment.positivePct,
      negative_pct: sentiment.negativePct,
      neutral_pct: sentiment.neutralPct,
      summary: sentiment.summary,
      sample_size: sentiment.sampleSize,
      created_at: new Date(sentiment.createdAt).toISOString(),
    };

    const res = await fetch(`${SENTIMENT_REST_URL}?on_conflict=video_id`, {
      method: 'POST',
      headers: {
        ...headers(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      log.warn(`sentiment store HTTP ${res.status}`, await res.text());
      return false;
    }
    log.info('sentiment stored', sentiment.videoId);
    return true;
  } catch (error) {
    log.warn('sentiment store failed (network)', error);
    return false;
  }
}
