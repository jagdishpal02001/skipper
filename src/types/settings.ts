import type { SegmentType } from './segment';

/**
 * User-configurable behaviour. Persisted in chrome.storage.sync so it follows
 * the user across machines.
 */
export interface Settings {
  /** Master switch for the whole extension. */
  enabled: boolean;
  /** Whether to auto-analyse a video as soon as it loads. */
  autoAnalyze: boolean;
  /** Show a toast each time a segment is skipped. */
  showNotifications: boolean;
  /** Per-category skip toggles. */
  skip: Record<SkippableCategory, boolean>;
}

/**
 * The subset of segment types that the user can independently enable/disable.
 * Categories not listed here are grouped under "sponsor".
 */
export type SkippableCategory =
  | 'sponsor'
  | 'self_promo'
  | 'intro'
  | 'outro';

/**
 * Maps a detected segment type onto the toggle category that governs it.
 */
export const CATEGORY_FOR_TYPE: Record<SegmentType, SkippableCategory> = {
  sponsor: 'sponsor',
  affiliate: 'sponsor',
  vpn: 'sponsor',
  course: 'sponsor',
  software: 'sponsor',
  product: 'sponsor',
  discount_code: 'sponsor',
  self_promo: 'self_promo',
  intro: 'intro',
  outro: 'outro',
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  autoAnalyze: true,
  showNotifications: true,
  skip: {
    sponsor: true,
    self_promo: true,
    intro: false,
    outro: false,
  },
};

