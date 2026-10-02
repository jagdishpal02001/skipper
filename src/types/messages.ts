import type { AnalysisResult, SponsorSegment } from './segment';
import type { Settings } from './settings';
import type { VideoMetadata } from './video';
import type { ErrorLogEntry } from './errorLog';
import type { UsageDelta, UsageSummary } from './usage';
import type { VideoSentiment } from './sentiment';
import type { GrowthState } from './growth';

/**
 * Runtime status of analysis for a given video. Surfaced in both the in-player
 * widget and the popup.
 */
export type AnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'ready'
  | 'error';

/**
 * State the content script publishes about the active tab/video. The popup
 * queries this on open.
 */
export interface VideoRuntimeState {
  metadata: VideoMetadata | null;
  status: AnalysisStatus;
  result: AnalysisResult | null;
  /** Number of segments skipped so far in this play session. */
  skippedCount: number;
  /** Seconds saved so far in this play session. */
  timeSavedSeconds: number;
  /** Whether the analysis came from cache. */
  fromCache: boolean;
  error?: string;
}

/**
 * Messages flowing FROM content/popup TO the background service worker.
 */
export type BackgroundRequest =
  | { type: 'SAVE_RESULT'; result: AnalysisResult }
  | { type: 'GET_CACHED'; videoId: string }
  | { type: 'CLEAR_CACHE'; videoId?: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'GET_CACHE_INFO' }
  | { type: 'ADD_ERROR_LOG'; videoId?: string; videoTitle?: string; errorMessage: string; analysisMode?: string }
  | { type: 'GET_ERROR_LOGS' }
  | { type: 'CLEAR_ERROR_LOGS' }
  | { type: 'SUPABASE_LOOKUP'; videoId: string; duration: number }
  | { type: 'SUPABASE_STORE'; videoId: string; duration: number; segments: SponsorSegment[]; provider?: string }
  | { type: 'SPONSORBLOCK_LOOKUP'; videoId: string }
  | { type: 'RECORD_USAGE'; delta: UsageDelta }
  | { type: 'GET_USAGE_STATS'; days?: number }
  | { type: 'CLEAR_USAGE_STATS' }
  /** Cheap cascade: local cache first, then the shared Supabase DB. */
  | { type: 'SENTIMENT_LOOKUP'; videoId: string }
  /** Persist a fresh verdict locally and share it via Supabase. */
  | { type: 'SENTIMENT_STORE'; sentiment: VideoSentiment }
  /** Rating-ask / milestone bookkeeping (see GrowthState). */
  | { type: 'GET_GROWTH' }
  | { type: 'UPDATE_GROWTH'; patch: Partial<GrowthState> }
  /** Number of skippable segments to show on the sender tab's toolbar icon. */
  | { type: 'SET_BADGE'; count: number }
  /** Open the dashboard page, optionally at its share section. */
  | { type: 'OPEN_DASHBOARD'; section?: 'share' };

export interface CacheInfo {
  entries: number;
  approxBytes: number;
}

/**
 * Discriminated response shape keyed by the originating request type.
 */
export type BackgroundResponseMap = {
  SAVE_RESULT: { ok: true };
  GET_CACHED: { ok: true; result: AnalysisResult | null };
  CLEAR_CACHE: { ok: true };
  GET_SETTINGS: { ok: true; settings: Settings };
  UPDATE_SETTINGS: { ok: true; settings: Settings };
  GET_CACHE_INFO: { ok: true; info: CacheInfo };
  ADD_ERROR_LOG: { ok: true };
  GET_ERROR_LOGS: { ok: true; logs: ErrorLogEntry[] };
  CLEAR_ERROR_LOGS: { ok: true };
  SUPABASE_LOOKUP: { ok: true; segments: SponsorSegment[] | null };
  SUPABASE_STORE: { ok: true };
  SPONSORBLOCK_LOOKUP: { ok: true; segments: SponsorSegment[] | null };
  /** `milestone`: all-time seconds saved, when this delta reached a new milestone. */
  RECORD_USAGE: { ok: true; milestone: number | null };
  GET_USAGE_STATS: { ok: true; summary: UsageSummary };
  CLEAR_USAGE_STATS: { ok: true };
  SENTIMENT_LOOKUP: { ok: true; sentiment: VideoSentiment | null };
  SENTIMENT_STORE: { ok: true };
  GET_GROWTH: { ok: true; growth: GrowthState };
  UPDATE_GROWTH: { ok: true; growth: GrowthState };
  SET_BADGE: { ok: true };
  OPEN_DASHBOARD: { ok: true };
};

export type BackgroundResponse<T extends BackgroundRequest['type']> =
  BackgroundResponseMap[T];

/**
 * Messages flowing FROM popup TO the active tab's content script.
 */
export type ContentRequest =
  | { type: 'GET_STATE' }
  | { type: 'REANALYZE' }
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'GET_SENTIMENT'; force?: boolean; cachedOnly?: boolean };

export type ContentResponseMap = {
  GET_STATE: { ok: true; state: VideoRuntimeState };
  REANALYZE: { ok: true };
  SET_ENABLED: { ok: true };
  GET_SENTIMENT: { ok: true; sentiment: VideoSentiment } | { ok: false; error: string };
};

export type ContentResponse<T extends ContentRequest['type']> =
  ContentResponseMap[T];
