/**
 * Device-local bookkeeping for Skipper's growth prompts (the rating ask and
 * the in-page milestone celebrations), so each shows only as often as
 * intended. Written only by the background worker.
 */
export interface GrowthState {
  /** When the user went to rate Skipper (epoch ms); 0 = never. */
  ratedAt: number;
  /** The popup's rating ask stays hidden until then (epoch ms). */
  rateSnoozedUntil: number;
  /** Largest all-time "time saved" milestone (seconds) already celebrated. */
  celebratedMilestone: number;
}

export const DEFAULT_GROWTH_STATE: GrowthState = {
  ratedAt: 0,
  rateSnoozedUntil: 0,
  celebratedMilestone: 0,
};
