import type { SponsorSegment } from '@/types';
import { createLogger } from '@/utils/logger';
import { localStorageArea } from '@/storage';

const log = createLogger('supabase');

// ---- Supabase config ----
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

const TABLE = 'segments';
const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
const REST_URL = `${cleanUrl}/rest/v1/${TABLE}`;

const headers = (): Record<string, string> => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
});

export interface SupabaseSegmentRow {
  video_id: string;
  duration: number;
  segments: SponsorSegment[];
  provider: string | null;
  created_at: string;
}

/**
 * Look up cached segments for a video by its composite key (videoId + duration).
 * Returns the segments array if found, null otherwise.
 * Fails silently — a network error just means "cache miss".
 */
export async function supabaseLookup(
  videoId: string,
  duration: number,
): Promise<SponsorSegment[] | null> {
  try {
    const url = `${REST_URL}?video_id=eq.${encodeURIComponent(videoId)}&duration=eq.${duration}&select=segments`;
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
      video_id: videoId,
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

let cachedClientId: string | null = null;

/**
 * Retrieve or generate a persistent anonymous client ID for telemetry.
 */
export async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  try {
    let id = await localStorageArea.get<string>('telemetry:client_id');
    if (!id) {
      id = crypto.randomUUID();
      await localStorageArea.set({ 'telemetry:client_id': id });
    }
    cachedClientId = id;
    return id;
  } catch (error) {
    log.warn('Failed to get/set clientId, using fallback', error);
    const fallbackId = 'anon_' + Math.random().toString(36).substring(2, 15);
    cachedClientId = fallbackId;
    return fallbackId;
  }
}

/**
 * Log a telemetry event (hit, miss, store, skip) to Supabase telemetry_logs table.
 * Fails silently.
 */
export async function supabaseLogEvent(
  eventType: string,
  videoId: string,
  extraData?: Record<string, any>,
): Promise<boolean> {
  try {
    const clientId = await getClientId();
    const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
    const logUrl = `${cleanUrl}/rest/v1/telemetry_logs`;

    const body = {
      client_id: clientId,
      event_type: eventType,
      video_id: videoId,
      extra_data: extraData ?? null,
    };

    const res = await fetch(logUrl, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      log.warn(`telemetry HTTP ${res.status}`, await res.text());
      return false;
    }

    return true;
  } catch (error) {
    log.warn('telemetry log failed (network)', error);
    return false;
  }
}
