import { createLogger } from '@/utils/logger';

const log = createLogger('player');

/**
 * Thin wrapper around the YouTube <video> element. Isolates all direct DOM
 * access so the skip engine can be reasoned about (and tested) without a real
 * page. Re-resolves the element lazily because YouTube swaps it during SPA
 * navigation.
 */
export class YouTubePlayer {
  private video: HTMLVideoElement | null = null;

  private resolve(): HTMLVideoElement | null {
    if (this.video && this.video.isConnected) return this.video;
    this.video = document.querySelector<HTMLVideoElement>(
      '.html5-main-video, video.video-stream',
    );
    return this.video;
  }

  get available(): boolean {
    return this.resolve() !== null;
  }

  get currentTime(): number {
    return this.resolve()?.currentTime ?? 0;
  }

  set currentTime(seconds: number) {
    const video = this.resolve();
    if (video) {
      video.currentTime = seconds;
      log.debug('seek →', seconds);
    }
  }

  get duration(): number {
    const d = this.resolve()?.duration ?? 0;
    return Number.isFinite(d) ? d : 0;
  }

  get playbackRate(): number {
    return this.resolve()?.playbackRate ?? 1;
  }

  /** Whether playback is currently paused (or no video is present). */
  get paused(): boolean {
    const video = this.resolve();
    return video ? video.paused : true;
  }

  /** A livestream has a non-finite duration. We must not auto-skip those. */
  get isLive(): boolean {
    const video = this.resolve();
    return video ? !Number.isFinite(video.duration) || video.duration === 0 : false;
  }
}
