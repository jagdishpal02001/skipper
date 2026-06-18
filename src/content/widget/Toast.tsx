import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/utils/time';
import type { SkipEvent } from '@/services';
import type { ContentController } from '../ContentController';

interface ToastItem {
  id: number;
  text: string;
}

const TOAST_TTL_MS = 3200;

/**
 * Renders transient "Skipped Sponsor Segment (m:ss → m:ss)" toasts in response
 * to skip events from the controller. This is the *only* in-page UI — there is
 * no persistent widget. Respects the user's "Show notifications" setting,
 * checked at emit time so toggling it takes effect immediately.
 */
export function ToastStack({ controller }: { controller: ContentController }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const unsub = controller.onSkipEvent((event: SkipEvent) => {
      if (!controller.notificationsEnabled) return;
      const id = nextId++;
      const text = `Skipped ${labelFor(event)} (${formatTimestamp(
        event.segment.start,
      )} → ${formatTimestamp(event.segment.end)})`;
      setToasts((prev) => [...prev, { id, text }]);
      window.setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        TOAST_TTL_MS,
      );
    });
    return unsub;
  }, [controller]);

  if (!toasts.length) return null;

  return (
    <div className="skipper-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="skipper-toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}

function labelFor(event: SkipEvent): string {
  switch (event.segment.type) {
    case 'self_promo':
      return 'Self Promo';
    case 'intro':
      return 'Intro';
    case 'outro':
      return 'Outro';
    default:
      return 'Sponsor Segment';
  }
}
