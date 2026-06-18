import type {
  Transcript,
  TranscriptSegment,
  TranscriptSource,
  VideoMetadata,
} from '@/types';
import { createLogger } from '@/utils/logger';
import type { CaptionTrack, YouTubeData } from './YouTubeData';

const log = createLogger('transcript');

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

/**
 * Retrieves and normalizes the transcript/metadata for a video.
 * Cascades through available sources in priority order:
 * manual captions, auto captions, chapters, description, and top comments.
 */
export class TranscriptService {
  constructor(private readonly data: YouTubeData) {}

  async getTranscript(
    videoId: string,
    metadata: VideoMetadata,
  ): Promise<Transcript | null> {
    const tracks = this.data.getCaptionTracks(videoId);

    // 1 & 2: caption tracks (manual preferred over auto-generated).
    const manual = tracks.find((t) => t.kind !== 'asr');
    const auto = tracks.find((t) => t.kind === 'asr');
    for (const [track, source] of [
      [manual, 'manual_captions'],
      [auto, 'auto_captions'],
    ] as const) {
      if (!track) continue;
      const transcript = await this.fromCaptionTrack(track, source);
      if (transcript) return transcript;
    }

    // 3: chapters.
    if (metadata.chapters?.length) {
      log.debug('falling back to chapters');
      return this.fromChapters(metadata);
    }

    // 4: description.
    if (metadata.description && metadata.description.trim().length > 40) {
      log.debug('falling back to description');
      return {
        source: 'description',
        text: metadata.description,
        segments: [],
      };
    }

    // 5: top comments.
    const comments = metadata.topComments ?? this.readCommentsFromDom();
    if (comments.length) {
      log.debug('falling back to comments');
      return {
        source: 'comments',
        text: comments.join('\n'),
        segments: [],
      };
    }

    log.warn('no transcript source available for', videoId);
    return null;
  }

  private async fromCaptionTrack(
    track: CaptionTrack,
    source: TranscriptSource,
  ): Promise<Transcript | null> {
    try {
      const url = `${track.baseUrl}${track.baseUrl.includes('fmt=') ? '' : '&fmt=json3'}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      const json = (await res.json()) as { events?: Json3Event[] };
      const segments = this.parseJson3(json.events ?? []);
      if (!segments.length) return null;
      return {
        source,
        text: segments.map((s) => s.text).join(' '),
        segments,
      };
    } catch (error) {
      log.warn('caption fetch failed', source, error);
      return null;
    }
  }

  private parseJson3(events: Json3Event[]): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    for (const e of events) {
      const text = (e.segs ?? [])
        .map((s) => s.utf8 ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const start = (e.tStartMs ?? 0) / 1000;
      const end = start + (e.dDurationMs ?? 0) / 1000;
      segments.push({ start, end, text });
    }
    return segments;
  }

  private fromChapters(metadata: VideoMetadata): Transcript {
    const chapters = metadata.chapters ?? [];
    const segments: TranscriptSegment[] = chapters.map((c, i) => {
      const next = chapters[i + 1];
      const end = next ? next.startSeconds : metadata.durationSeconds || c.startSeconds + 1;
      return { start: c.startSeconds, end, text: c.title };
    });
    return {
      source: 'chapters',
      text: chapters.map((c) => c.title).join('\n'),
      segments,
    };
  }

  private readCommentsFromDom(): string[] {
    const nodes = document.querySelectorAll<HTMLElement>(
      'ytd-comment-thread-renderer #content-text',
    );
    return Array.from(nodes)
      .slice(0, 20)
      .map((n) => n.innerText.trim())
      .filter(Boolean);
  }
}
