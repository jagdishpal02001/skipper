import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { sendToBackground } from '@/utils/messaging';

interface UseSettings {
  settings: Settings;
  loading: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
}

/**
 * Loads settings from the background worker and keeps them in sync with
 * chrome.storage changes (e.g. edits made from another window).
 */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void sendToBackground({ type: 'GET_SETTINGS' }).then((res) => {
      if (active) {
        setSettings(res.settings);
        setLoading(false);
      }
    });

    const handler = (
      _changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'sync') return;
      void sendToBackground({ type: 'GET_SETTINGS' }).then(
        (res) => active && setSettings(res.settings),
      );
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const res = await sendToBackground({ type: 'UPDATE_SETTINGS', patch });
    setSettings(res.settings);
  }, []);

  return { settings, loading, update };
}
