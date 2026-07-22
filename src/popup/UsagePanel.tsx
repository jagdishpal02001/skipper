import { Card, StatBadge } from '@/components';
import { useUsageStats } from '@/hooks';
import { formatDuration } from '@/utils/time';

/**
 * Compact usage summary in the popup: all-time time saved plus today's total
 * time on YouTube, with a link to the full dashboard page.
 */
export function UsagePanel() {
  // Today's totals; all-time comes back on the same payload.
  const { summary } = useUsageStats(1);

  const openDashboard = () => {
    void chrome.tabs.create({
      url: chrome.runtime.getURL('src/dashboard/index.html'),
    });
  };

  const saved = summary ? formatDuration(summary.allTime.timeSavedSeconds) : '—';
  const today = summary ? formatDuration(summary.range.totalSeconds) : '—';

  return (
    <Card
      title="Your activity"
      action={
        <button
          onClick={openDashboard}
          className="text-[11px] font-semibold text-brand-400 hover:underline cursor-pointer"
        >
          View dashboard ↗
        </button>
      }
    >
      <div className="flex gap-2">
        <StatBadge value={saved} label="Saved · all time" />
        <StatBadge value={today} label="On YouTube today" />
      </div>
    </Card>
  );
}
