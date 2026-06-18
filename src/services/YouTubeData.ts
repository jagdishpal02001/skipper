import type { VideoChapter, VideoMetadata } from '@/types';
import { createLogger } from '@/utils/logger';
import { parseTimestamp } from '@/utils/youtube';

const log = createLogger('yt-data');

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** 'asr' indicates auto-generated captions. */
  kind?: string;
  name?: string;
}

interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: string;
    shortDescription?: string;
    isLiveContent?: boolean;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: {
        baseUrl: string;
        languageCode: string;
        kind?: string;
        name?: { simpleText?: string };
      }[];
    };
  };
}

/**
 * Reads YouTube's internal player response for a video and exposes the bits we
 * need: metadata and caption tracks. Works by re-fetching the watch page HTML
 * (same-origin from the content script) and extracting the embedded
 * `ytInitialPlayerResponse` JSON — robust against SPA navigation and isolated
 * from the page's JS world.
 */
export class YouTubeData {
  private cache = new Map<string, PlayerResponse>();

  async load(videoId: string): Promise<void> {
    if (this.cache.has(videoId)) return;
    const response = await this.fetchPlayerResponse(videoId);
    if (response) this.cache.set(videoId, response);
  }

  getMetadata(videoId: string, fallbackTitle?: string): VideoMetadata {
    const pr = this.cache.get(videoId);
    const details = pr?.videoDetails;
    const description = details?.shortDescription ?? '';
    return {
      videoId,
      title: details?.title ?? fallbackTitle ?? document.title,
      channel: details?.author ?? this.readChannelFromDom(),
      durationSeconds: details?.lengthSeconds ? Number(details.lengthSeconds) : 0,
      description,
      chapters: this.parseChapters(description),
      isLive: Boolean(details?.isLiveContent),
    };
  }

  getCaptionTracks(videoId: string): CaptionTrack[] {
    const tracks =
      this.cache.get(videoId)?.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks ?? [];
    return tracks.map((t) => ({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode,
      kind: t.kind,
      name: t.name?.simpleText,
    }));
  }

  invalidate(videoId: string): void {
    this.cache.delete(videoId);
  }

  private async fetchPlayerResponse(
    videoId: string,
  ): Promise<PlayerResponse | null> {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        credentials: 'include',
      });
      const html = await res.text();
      const match = html.match(
        /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s,
      );
      if (!match?.[1]) {
        log.warn('player response not found in HTML for', videoId);
        return null;
      }
      return JSON.parse(match[1]) as PlayerResponse;
    } catch (error) {
      log.error('failed to fetch player response', error);
      return null;
    }
  }

  private readChannelFromDom(): string {
    const el = document.querySelector(
      'ytd-channel-name #text a, ytd-video-owner-renderer .ytd-channel-name a',
    );
    return el?.textContent?.trim() ?? '';
  }

  /** Best-effort chapter extraction from description timestamp lines. */
  private parseChapters(description: string): VideoChapter[] {
    const chapters: VideoChapter[] = [];
    const lineRe = /(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/g;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(description)) !== null) {
      const seconds = parseTimestamp(m[1] ?? '');
      const title = (m[2] ?? '').trim();
      if (seconds !== null && title) {
        chapters.push({ startSeconds: seconds, title });
      }
    }
    return chapters;
  }
}
