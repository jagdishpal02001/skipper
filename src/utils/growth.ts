import { formatDuration } from './time';

/**
 * Links, thresholds and copy for Skipper's growth surfaces — the rating ask,
 * the share buttons and the in-page milestone celebration. Kept free of side
 * effects so they can be unit tested in isolation.
 */

/** Chrome Web Store listing. The short slug redirects to the canonical one. */
export const STORE_URL =
  'https://chromewebstore.google.com/detail/skipper-ai/ncchpipphiigdfbpbjofbhbahcgckaob';
export const REVIEWS_URL = `${STORE_URL}/reviews`;
export const FEEDBACK_URL =
  'https://github.com/jagdishpal02001/skipper/issues/new';

/** All-time "time saved" totals (seconds) celebrated with an in-page toast. */
export const MILESTONES = [600, 3600, 3 * 3600, 10 * 3600, 24 * 3600];

/** Skips a user has had before the popup asks for a rating. */
export const RATE_PROMPT_MIN_SKIPS = 5;
/** How long "Later" hides the rating ask. */
export const RATE_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** The largest milestone `savedSeconds` has reached, or 0 for none. */
export function milestoneFor(savedSeconds: number): number {
  let reached = 0;
  for (const m of MILESTONES) if (savedSeconds >= m) reached = m;
  return reached;
}

export type ShareChannel =
  | 'whatsapp'
  | 'x'
  | 'telegram'
  | 'facebook'
  | 'reddit'
  | 'email'
  | 'copy';

export interface ShareStats {
  skipCount: number;
  timeSavedSeconds: number;
}

/**
 * The store link, tagged with the channel it was shared through so installs
 * from shares show up in the listing's acquisition stats.
 */
export function shareUrl(channel: ShareChannel): string {
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: 'share',
    utm_campaign: 'in_app',
  });
  return `${STORE_URL}?${params}`;
}

/** The share blurb — personalized with the user's own numbers once they have some. */
export function shareMessage(stats?: ShareStats | null): string {
  if (stats && stats.skipCount > 0) {
    const segments = `${stats.skipCount} sponsor segment${stats.skipCount === 1 ? '' : 's'}`;
    return (
      `Skipper has auto-skipped ${segments} on YouTube for me — ` +
      `${formatDuration(stats.timeSavedSeconds)} saved so far. ` +
      "It's free, no account needed:"
    );
  }
  return (
    'I use Skipper to auto-skip sponsor segments on YouTube and see what ' +
    "viewers think of a video before watching. It's free, no account needed:"
  );
}

/** Where a share button sends the user: that app's own share page. */
export function shareLink(
  channel: Exclude<ShareChannel, 'copy'>,
  text: string,
): string {
  const url = shareUrl(channel);
  const e = encodeURIComponent;
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/?text=${e(`${text} ${url}`)}`;
    case 'x':
      return `https://x.com/intent/tweet?text=${e(text)}&url=${e(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${e(url)}&text=${e(text)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${e(url)}&title=${e(
        'Skipper — auto-skip sponsors on YouTube (free)',
      )}`;
    case 'email':
      return `mailto:?subject=${e('Skip YouTube sponsors automatically')}&body=${e(
        `${text}\n\n${url}`,
      )}`;
  }
}
