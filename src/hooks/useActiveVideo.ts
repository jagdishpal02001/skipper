import { useCallback, useEffect, useState } from 'react';
import type { VideoRuntimeState } from '@/types';
import { getActiveTab, sendToTab } from '@/utils/messaging';
import { isWatchUrl } from '@/utils/youtube';

interface UseActiveVideo {
  state: VideoRuntimeState | null;
  /** True when the active tab is a YouTube watch page with our content script. */
  isYouTube: boolean;
  tabId: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  reanalyze: () => Promise<void>;
}

/**
 * Queries the active tab's content script for the live video runtime state.
 * Polls lightly so the popup reflects skips happening in real time.
 */
export function useActiveVideo(): UseActiveVideo {
  const [state, setState] = useState<VideoRuntimeState | null>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const tab = await getActiveTab();
    const onYouTube = Boolean(tab?.url && isWatchUrl(tab.url));
    setIsYouTube(onYouTube);
    setTabId(tab?.id ?? null);
    if (!tab?.id || !onYouTube) {
      setState(null);
      setLoading(false);
      return;
    }
    try {
      const res = await sendToTab(tab.id, { type: 'GET_STATE' });
      setState(res.state);
    } catch {
      // Content script not ready (e.g. tab opened before install).
      setState(null);
    }
    setLoading(false);
  }, []);

  const reanalyze = useCallback(async () => {
    if (tabId == null) return;
    await sendToTab(tabId, { type: 'REANALYZE' });
    await refresh();
  }, [tabId, refresh]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1500);
    return () => clearInterval(interval);
  }, [refresh]);

  return { state, isYouTube, tabId, loading, refresh, reanalyze };
}
