import { useCallback, useEffect, useState } from 'react';
import type { CacheInfo } from '@/types';
import { sendToBackground } from '@/utils/messaging';

interface UseCacheInfo {
  info: CacheInfo | null;
  refresh: () => Promise<void>;
  clearAll: () => Promise<void>;
  clearOne: (videoId: string) => Promise<void>;
}

/** Reads cache statistics and exposes cache-clearing actions. */
export function useCacheInfo(): UseCacheInfo {
  const [info, setInfo] = useState<CacheInfo | null>(null);

  const refresh = useCallback(async () => {
    const res = await sendToBackground({ type: 'GET_CACHE_INFO' });
    setInfo(res.info);
  }, []);

  const clearAll = useCallback(async () => {
    await sendToBackground({ type: 'CLEAR_CACHE' });
    await refresh();
  }, [refresh]);

  const clearOne = useCallback(
    async (videoId: string) => {
      await sendToBackground({ type: 'CLEAR_CACHE', videoId });
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { info, refresh, clearAll, clearOne };
}
