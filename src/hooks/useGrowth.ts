import { useCallback, useEffect, useState } from 'react';
import type { GrowthState } from '@/types';
import { sendToBackground } from '@/utils/messaging';

interface UseGrowth {
  /** Null until loaded, so prompts never flash before their state is known. */
  growth: GrowthState | null;
  update: (patch: Partial<GrowthState>) => Promise<void>;
}

/** The growth prompts' device-local state, via the background worker. */
export function useGrowth(): UseGrowth {
  const [growth, setGrowth] = useState<GrowthState | null>(null);

  useEffect(() => {
    let active = true;
    void sendToBackground({ type: 'GET_GROWTH' }).then(
      (res) => active && setGrowth(res.growth),
    );
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(async (patch: Partial<GrowthState>) => {
    const res = await sendToBackground({ type: 'UPDATE_GROWTH', patch });
    setGrowth(res.growth);
  }, []);

  return { growth, update };
}
