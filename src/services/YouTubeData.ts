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
 * need: metadata and caption tracks.
 *
 * Resolution order, chosen for reliability after a reload/navigation:
 *   1. The `ytInitialPlayerResponse` already embedded in the loaded page's
 *      inline <script> — present and correct right after a reload, and free
 *      (no network). Validated against the requested videoId.
 *   2. A same-origin re-fetch of the watch page — covers SPA navigations where
 *      the embedded copy still belongs to the previous video.
 *
 * Both paths parse the JSON with a balanced-brace scan rather than a regex, so
 * extraction survives YouTube's frequent markup changes.
 */
export class YouTubeData {
  private cache = new Map<string, PlayerResponse>();

  /** Returns true once a usable player response is cached for the video. */
  async load(videoId: string): Promise<boolean> {
    if (this.cache.has(videoId)) return true;

    // 1. Prefer the copy already in the page (reliable on reload, no network).
    const fromDom = this.readPlayerResponseFromDom(videoId);
    if (fromDom) {
      this.cache.set(videoId, fromDom);
      return true;
    }

    // 2. Fall back to re-fetching the watch page (SPA navigations).
    const fetched = await this.fetchPlayerResponse(videoId);
    if (fetched) {
      this.cache.set(videoId, fetched);
      return true;
    }
    return false;
  }

  /** Whether a usable player response is cached for the video. */
  has(videoId: string): boolean {
    return this.cache.has(videoId);
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

  // ---- player response extraction ---------------------------------------

  /**
   * Find `ytInitialPlayerResponse` in the page's inline scripts. The variable
   * itself lives in the page's main world (which a content script can't read),
   * but the same JSON is present as text in an inline <script>, which we can.
   * Only returns it if it belongs to the requested video — after an SPA
   * navigation the embedded copy is stale (still the previous video).
   */
  private readPlayerResponseFromDom(videoId: string): PlayerResponse | null {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes('ytInitialPlayerResponse')) continue;
      const pr = this.parseAssignedObject(text, 'ytInitialPlayerResponse');
      if (pr && pr.videoDetails?.videoId === videoId) return pr;
    }
    return null;
  }

  private async fetchPlayerResponse(
    videoId: string,
  ): Promise<PlayerResponse | null> {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        credentials: 'include',
      });
      const html = await res.text();
      const pr = this.parseAssignedObject(html, 'ytInitialPlayerResponse');
      if (!pr) {
        log.warn('player response not found in HTML for', videoId);
        return null;
      }
      return pr;
    } catch (error) {
      log.error('failed to fetch player response', error);
      return null;
    }
  }

  /**
   * Parse `<name> = { ... }` out of arbitrary JS/HTML text by locating the
   * assignment and reading the balanced-brace object that follows.
   */
  private parseAssignedObject(
    text: string,
    name: string,
  ): PlayerResponse | null {
    // Skip occurrences that aren't the assignment (e.g. later references).
    let markerIdx = text.indexOf(name);
    while (markerIdx >= 0) {
      const eq = text.indexOf('=', markerIdx + name.length);
      const braceIdx = eq >= 0 ? text.indexOf('{', eq) : -1;
      // The '{' must follow closely; otherwise this wasn't the assignment.
      if (eq >= 0 && braceIdx >= 0 && braceIdx - eq <= 3) {
        const obj = this.extractBalancedJson(text, braceIdx);
        if (obj) return obj;
      }
      markerIdx = text.indexOf(name, markerIdx + name.length);
    }
    return null;
  }

  /** Parse the balanced-brace JSON object starting at `start` (the '{'). */
  private extractBalancedJson(text: string, start: number): PlayerResponse | null {
    if (start < 0 || text[start] !== '{') return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
        if (--depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1)) as PlayerResponse;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
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
