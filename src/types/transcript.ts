/**
 * A single timed chunk of a transcript.
 */
export interface TranscriptSegment {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  text: string;
}

/**
 * Where a transcript originated. Providers are tried in priority order and the
 * source is recorded so the analysis prompt can be tuned accordingly.
 */
export type TranscriptSource =
  | 'manual_captions'
  | 'auto_captions'
  | 'chapters'
  | 'description'
  | 'comments';

/**
 * A normalised transcript, independent of where it was sourced from.
 */
export interface Transcript {
  source: TranscriptSource;
  /** The full transcript text, useful for providers that ignore timing. */
  text: string;
  segments: TranscriptSegment[];
}
