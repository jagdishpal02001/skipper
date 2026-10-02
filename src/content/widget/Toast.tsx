import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/utils/time';
import type { SkipEvent } from '@/services';
import type { ContentController, ContentNotice } from '../ContentController';

interface ToastItem {
  id: number;
  text: string;
  /** Skip toasts carry a seek-back target; notice toasts ("error"/"info") don't. */
  kind: 'skip' | ContentNotice['kind'];
  segmentStart?: number;
  actions?: ContentNotice['actions'];
}

const TOAST_TTL_MS = 3200;
/** Toasts with buttons stay up long enough to read and act on. */
const ACTION_TOAST_TTL_MS = 12000;

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
        item.actions?.length ? ACTION_TOAST_TTL_MS : TOAST_TTL_MS,
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
      push({ kind: notice.kind, text: notice.text, actions: notice.actions });
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
            t.kind === 'error' || t.kind === 'milestone'
              ? ` skipper-toast--${t.kind}`
              : ''
          }`}
        >
          <span>{t.text}</span>
          {t.kind === 'skip' && t.segmentStart !== undefined && (
            <button
              className="skipper-toast-action"
              onClick={() => controller.undoSkip(t.segmentStart!)}
            >
              Undo
            </button>
          )}
          {t.actions?.map((action) => (
            <button
              key={action.label}
              className="skipper-toast-action"
              onClick={() => {
                action.run();
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
              }}
            >
              {action.label}
            </button>
          ))}
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
