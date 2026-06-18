/**
 * Lightweight metadata describing the currently playing video. Collected in the
 * content script and forwarded to the background worker for analysis.
 */
export interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  /** Total duration in seconds. Zero for livestreams or before metadata loads. */
  durationSeconds: number;
  description?: string;
  chapters?: VideoChapter[];
  topComments?: string[];
  isLive: boolean;
}

export interface VideoChapter {
  title: string;
  startSeconds: number;
}
