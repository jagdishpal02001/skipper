/**
 * A single viewer comment with its engagement weight. Like counts matter: a
 * comment with thousands of likes speaks for thousands of viewers, so the
 * sentiment prompt weights comments by them.
 */
export interface VideoComment {
  text: string;
  likes: number;
}

/**
 * Audience-sentiment analysis for a video, derived by feeding its top comments
 * to YouTube's "Ask about this video" Gemini and parsing a structured verdict.
 */
export interface VideoSentiment {
  videoId: string;
  /** Overall audience rating, 0–10. */
  rating: number;
  /** Share of comments read as positive, 0–100. */
  positivePct: number;
  /** Share read as negative, 0–100. */
  negativePct: number;
  /** Share read as neutral/mixed, 0–100. */
  neutralPct: number;
  /** One or two sentences summarising what viewers think. */
  summary: string;
  /** How many comments the verdict was based on. */
  sampleSize: number;
  /** When the analysis was produced (epoch ms). */
  createdAt: number;
}
