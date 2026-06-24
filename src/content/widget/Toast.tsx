import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/utils/time';
import type { SkipEvent } from '@/services';
import type { ContentController } from '../ContentController';

interface ToastItem {
  id: number;
  text: string;
  /** Skip toasts carry a seek-back target; notice toasts ("error"/"info") don't. */
  kind: 'skip' | 'error' | 'info';
  segmentStart?: number;
}

const TOAST_TTL_MS = 3200;

/**
 * Renders transient in-page toasts: "Skipped Sponsor Segment (m:ss → m:ss)" on
 * skip events, plus short notices (e.g. analysis failures) so the user learns
 * why nothing happened without opening the popup. This is the *only* in-page
 * UI — there is no persistent widget. Respects the user's "Show notifications"
 * setting, checked at emit time so toggling it takes effect immediately.
 */
export function ToastStack({ controller }: { controller: ContentController }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    const push = (item: Omit<ToastItem, 'id'>) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { ...item, id }]);
      window.setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        TOAST_TTL_MS,
      );
    };

    const unsubSkip = controller.onSkipEvent((event: SkipEvent) => {
      if (!controller.notificationsEnabled) return;
      push({
        kind: 'skip',
        text: `Skipped ${labelFor(event)} (${formatTimestamp(
          event.segment.start,
        )} → ${formatTimestamp(event.segment.end)})`,
        segmentStart: event.segment.start,
      });
    });

    const unsubNotice = controller.onNotice((notice) => {
      if (!controller.notificationsEnabled) return;
      push({ kind: notice.kind, text: notice.text });
    });

    return () => {
      unsubSkip();
      unsubNotice();
    };
  }, [controller]);

  if (!toasts.length) return null;

  return (
    <div className="skipper-toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`skipper-toast${
            t.kind === 'error' ? ' skipper-toast--error' : ''
          }`}
        >
          <span>{t.text}</span>
          {t.kind === 'skip' && t.segmentStart !== undefined && (
            <button
              className="skipper-toast-undo"
              onClick={() => controller.undoSkip(t.segmentStart!)}
            >
              Undo
            </button>
          )}
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
