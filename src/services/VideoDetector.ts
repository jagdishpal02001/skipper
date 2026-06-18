import { createLogger } from '@/utils/logger';
import { extractVideoId } from '@/utils/youtube';

const log = createLogger('detector');

export type VideoChangeListener = (videoId: string | null) => void;

/**
 * Detects which video the user is watching and notifies when it changes.
 *
 * YouTube is a single-page app, so a hard navigation almost never happens.
 * We listen to:
 *   - `yt-navigate-finish` — YouTube's own SPA navigation event
 *   - `popstate`           — browser back/forward
 *   - a polling safety net — covers edge cases where the event is missed
 *
 * All listeners funnel through {@link check} which only emits on real change.
 */
export class VideoDetector {
  private currentId: string | null = null;
  private listeners = new Set<VideoChangeListener>();
  private pollTimer: number | null = null;
  private readonly boundCheck = () => this.check();

  start(): void {
    document.addEventListener('yt-navigate-finish', this.boundCheck);
    window.addEventListener('popstate', this.boundCheck);
    // Safety net for missed SPA events; 1s is imperceptible and cheap.
    this.pollTimer = window.setInterval(this.boundCheck, 1000);
    this.check();
  }

  stop(): void {
    document.removeEventListener('yt-navigate-finish', this.boundCheck);
    window.removeEventListener('popstate', this.boundCheck);
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.listeners.clear();
  }

  onChange(listener: VideoChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get videoId(): string | null {
    return this.currentId;
  }

  private check(): void {
    const next = extractVideoId(location.href);
    if (next === this.currentId) return;
    log.info('video changed', this.currentId, '→', next);
    this.currentId = next;
    for (const listener of this.listeners) listener(next);
  }
}
