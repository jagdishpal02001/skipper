import { useEffect, useState } from 'react';
import { Button, Card } from '@/components';
import { sendToTab } from '@/utils/messaging';
import type { VideoSentiment } from '@/types';
import type { useActiveVideo } from '@/hooks';

type ActiveVideo = ReturnType<typeof useActiveVideo>;

/** Positive / neutral / negative split colours (semantic, with text labels). */
const SPLIT = [
  { key: 'positivePct', label: 'Positive', color: '#3fb37f' },
  { key: 'neutralPct', label: 'Neutral', color: '#6b7280' },
  { key: 'negativePct', label: 'Negative', color: '#e0506a' },
] as const;

/** Colour the /10 rating by band: green (good), amber (mixed), red (poor). */
function ratingColor(rating: number): string {
  if (rating >= 7) return '#3fb37f';
  if (rating >= 4) return '#c9992b';
  return '#e0506a';
}

/**
 * "What people think" — audience sentiment derived from the video's top
 * comments via YouTube's Ask Gemini. Runs only when the user asks (it drives
 * Gemini and costs a few seconds).
 */
export function SentimentPanel({ video }: { video: ActiveVideo }) {
  const { tabId, isYouTube, state } = video;
  const videoId = state?.metadata?.videoId ?? null;

  const [sentiment, setSentiment] = useState<VideoSentiment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the active video changes, then show any cached/shared verdict
  // immediately. `cachedOnly` guarantees this never triggers a Gemini run —
  // the popup only *starts* analysis on an explicit click.
  useEffect(() => {
    setSentiment(null);
    setError(null);
    setLoading(false);
    if (tabId == null || !videoId) return;
    let cancelled = false;
    void sendToTab(tabId, { type: 'GET_SENTIMENT', cachedOnly: true })
      .then((res) => {
        if (!cancelled && res.ok) setSentiment(res.sentiment);
      })
      .catch(() => {
        /* content script not ready — the button still works */
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, tabId]);

  if (!isYouTube || !videoId) return null;

  const analyze = async (force = false) => {
    if (tabId == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sendToTab(tabId, { type: 'GET_SENTIMENT', force });
      if (res.ok) setSentiment(res.sentiment);
      else setError(res.error);
    } catch {
      setError('Could not analyze this video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="What people think">
      {!sentiment && !loading && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-gray-400 leading-normal">
            Reads the top comments and asks Gemini for an overall audience
            verdict.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button variant="primary" block onClick={() => void analyze()}>
            Analyze comments
          </Button>
        </div>
      )}

      {loading && (
        <p className="py-3 text-center text-xs text-gray-400">
          Reading comments &amp; asking Gemini…
        </p>
      )}

      {sentiment && !loading && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 text-center"
              style={{ borderColor: ratingColor(sentiment.rating) }}
            >
              <div>
                <div
                  className="text-lg font-bold leading-none"
                  style={{ color: ratingColor(sentiment.rating) }}
                >
                  {sentiment.rating.toFixed(1)}
                </div>
                <div className="text-[8px] uppercase tracking-wide text-gray-500">
                  / 10
                </div>
              </div>
            </div>
            <p className="flex-1 text-[11.5px] leading-snug text-gray-300">
              {sentiment.summary || 'No summary available.'}
            </p>
          </div>

          <div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-700">
              {SPLIT.map((s) => {
                const pct = sentiment[s.key];
                return pct > 0 ? (
                  <div
                    key={s.key}
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${pct}%`}
                  />
                ) : null;
              })}
            </div>
            <div className="mt-1.5 flex justify-between">
              {SPLIT.map((s) => (
                <div key={s.key} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-[10px] text-gray-400">
                    {s.label} {sentiment[s.key]}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">
              Based on {sentiment.sampleSize} comment
              {sentiment.sampleSize === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => void analyze(true)}
              className="text-[10px] font-semibold text-brand-400 hover:underline cursor-pointer"
            >
              Re-analyze
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
