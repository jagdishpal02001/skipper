/**
 * The category of a detected promotional segment. These map directly onto the
 * user-facing skip toggles in the settings panel.
 */
export type SegmentType =
  | 'sponsor'
  | 'self_promo'
  | 'affiliate'
  | 'vpn'
  | 'course'
  | 'software'
  | 'product'
  | 'discount_code'
  | 'intro'
  | 'outro';

/**
 * A single promotional segment within a video, expressed in seconds from the
 * start of the video.
 */
export interface SponsorSegment {
  /** Inclusive start time, in seconds. */
  start: number;
  /** Inclusive end time, in seconds. */
  end: number;
  /** The kind of promotion this segment represents. */
  type: SegmentType;
  /** Model confidence in the range [0, 1]. */
  confidence: number;
  /** Identifier of the provider that produced this segment. */
  source?: string;
}

/**
 * The result of analysing a single video, as persisted in the cache.
 */
export interface AnalysisResult {
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number;
  segments: SponsorSegment[];
  /** Identifier of the provider that produced the segments. */
  provider: string;
  /** Epoch milliseconds at which the analysis was produced. */
  createdAt: number;
}
