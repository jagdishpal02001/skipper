import { Button } from '@/components';
import { useGrowth } from '@/hooks';
import {
  FEEDBACK_URL,
  RATE_PROMPT_MIN_SKIPS,
  RATE_SNOOZE_MS,
  REVIEWS_URL,
} from '@/utils/growth';

/**
 * Asks for a Chrome Web Store rating once Skipper has proven itself (a few
 * skips in), until the user rates or snoozes it. Ratings drive the store's
 * ranking more than anything else. The feedback link is always offered next
 * to it, so unhappy users have a direct way to report problems.
 */
export function RatePrompt({ skipCount }: { skipCount: number }) {
  const { growth, update } = useGrowth();

  if (
    !growth ||
    growth.ratedAt > 0 ||
    Date.now() < growth.rateSnoozedUntil ||
    skipCount < RATE_PROMPT_MIN_SKIPS
  ) {
    return null;
  }

  const rate = () => {
    void chrome.tabs.create({ url: REVIEWS_URL });
    void update({ ratedAt: Date.now() });
  };

  return (
    <section className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-surface-800 p-3">
      <p className="text-sm font-semibold text-white">⭐ Enjoying Skipper?</p>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
        It has skipped {skipCount} sponsor segments for you so far. A quick
        rating helps other people find it.
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button variant="primary" block onClick={rate}>
          Rate Skipper
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            void update({ rateSnoozedUntil: Date.now() + RATE_SNOOZE_MS })
          }
        >
          Later
        </Button>
      </div>
      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-center text-[10.5px] text-gray-500 hover:text-gray-300 hover:underline"
      >
        Something not working? Tell us
      </a>
    </section>
  );
}
