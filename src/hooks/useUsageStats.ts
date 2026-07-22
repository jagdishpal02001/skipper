import { useCallback, useEffect, useState } from 'react';
import type { UsageSummary } from '@/types';
import { sendToBackground } from '@/utils/messaging';

interface UseUsageStats {
  summary: UsageSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

/**
 * Reads aggregated usage analytics for a range of days (0 = all time) and
 * exposes a reset action. Shared by the popup summary and the dashboard.
 */
export function useUsageStats(days: number): UseUsageStats {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sendToBackground({ type: 'GET_USAGE_STATS', days });
      if (res.ok) setSummary(res.summary);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const reset = useCallback(async () => {
    await sendToBackground({ type: 'CLEAR_USAGE_STATS' });
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, refresh, reset };
}
