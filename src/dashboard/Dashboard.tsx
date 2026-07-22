import { useMemo, useState } from 'react';
import { Card } from '@/components';
import { useUsageStats } from '@/hooks';
import { formatDuration } from '@/utils/time';
import type { ChannelTotal, UsageTotals } from '@/types';

/**
 * Categorical colours for the three time buckets. Fixed order, never cycled.
 * Validated CVD-safe against the dark surface (see the dataviz validator):
 * watch↔browse↔shorts all pass the lightness band, chroma floor, CVD ΔE≥8,
 * normal-vision floor and contrast checks. Direct labels provide the required
 * secondary encoding.
 */
const BUCKET = {
  watch: { label: 'Watching', color: '#3f86d8' },
  browse: { label: 'Browsing', color: '#c07d1f' },
  shorts: { label: 'Shorts', color: '#d64463' },
} as const;

const RANGES: { label: string; days: number }[] = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'All time', days: 0 },
];

export function Dashboard() {
  const [days, setDays] = useState(0);
  const { summary, loading, refresh, reset } = useUsageStats(days);

  const handleReset = async () => {
    if (
      confirm(
        'Reset all usage stats? This permanently clears your local analytics.',
      )
    ) {
      await reset();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
          S
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-semibold leading-tight text-white">
            Your YouTube activity
          </h1>
          <p className="text-xs text-gray-400">
            Everything below is stored only on this device.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-surface-700"
        >
          Refresh
        </button>
      </header>

      {/* Time saved — the headline number, always all-time ("overall"). */}
      <div className="mb-5 rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-600/20 to-surface-800 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-brand-400">
          Time saved with Skipper
        </div>
        <div className="mt-1 text-4xl font-bold text-white">
          {summary ? formatDuration(summary.allTime.timeSavedSeconds) : '—'}
        </div>
        <div className="mt-1 text-xs text-gray-400">
          across{' '}
          <span className="font-semibold text-gray-200">
            {summary?.allTime.skipCount ?? 0}
          </span>{' '}
          segment{summary?.allTime.skipCount === 1 ? '' : 's'} skipped, all time
        </div>
      </div>

      {/* Range toggle governs everything below. */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-surface-800 p-1">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              days === r.days
                ? 'bg-brand-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && !summary ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
      ) : summary ? (
        <div className="flex flex-col gap-5">
          <TimeBreakdown totals={summary.range} />
          <TopChannels channels={summary.topChannels} />

          <div className="flex justify-end">
            <button
              onClick={() => void handleReset()}
              className="text-xs font-medium text-red-400 hover:underline"
            >
              Reset all stats
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Total active time on YouTube, split across the three buckets. */
function TimeBreakdown({ totals }: { totals: UsageTotals }) {
  const total = totals.totalSeconds;
  const parts = [
    { ...BUCKET.watch, seconds: totals.watchSeconds },
    { ...BUCKET.browse, seconds: totals.browseSeconds },
    { ...BUCKET.shorts, seconds: totals.shortsSeconds },
  ];

  return (
    <Card title="Time on YouTube">
      <div className="mb-3 text-3xl font-bold text-white">
        {formatDuration(total)}
      </div>

      {total > 0 ? (
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {parts.map((p) =>
            p.seconds > 0 ? (
              <div
                key={p.label}
                className="h-full"
                style={{
                  width: `${(p.seconds / total) * 100}%`,
                  backgroundColor: p.color,
                  // 2px surface-coloured gap between adjacent fills (mark spec).
                  // The Card fill is surface-800 (#171a21).
                  boxShadow: '2px 0 0 0 #171a21',
                }}
                title={`${p.label}: ${formatDuration(p.seconds)}`}
              />
            ) : null,
          )}
        </div>
      ) : (
        <div className="h-3 w-full rounded-full bg-surface-700" />
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        {parts.map((p) => (
          <div key={p.label}>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                {p.label}
              </span>
            </div>
            <div className="mt-0.5 text-lg font-semibold text-white">
              {formatDuration(p.seconds)}
            </div>
            <div className="text-[11px] text-gray-500">
              {total > 0 ? Math.round((p.seconds / total) * 100) : 0}%
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Top channels by watch time — horizontal bars, one series (magnitude). */
function TopChannels({ channels }: { channels: ChannelTotal[] }) {
  const max = useMemo(
    () => channels.reduce((m, c) => Math.max(m, c.seconds), 0),
    [channels],
  );

  return (
    <Card title="Top channels by watch time">
      {channels.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">
          No watch time recorded yet in this range.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {channels.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-right text-xs font-medium text-gray-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-gray-200" title={c.name}>
                    {c.name}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-gray-400">
                    {formatDuration(c.seconds)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-700">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${max > 0 ? (c.seconds / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
