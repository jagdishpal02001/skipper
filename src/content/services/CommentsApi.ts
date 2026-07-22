import type { VideoComment } from '@/types';
import { createLogger } from '@/utils/logger';
import {
  YT_ORIGIN,
  buildAuthHeader,
  collectContinuationTokens,
  extractAssignedJson,
  extractInnertubeContext,
  fetchWatchPageHtml,
  innertubeHeaders,
  postInnertube,
} from './innertube';

const log = createLogger('comments-api');

const ENDPOINT = `${YT_ORIGIN}/youtubei/v1/next?prettyPrint=false`;
/** Cap on comments returned (one "Top comments" page ≈ 20). */
const DEFAULT_MAX = 40;

/**
 * Fetches the top comments for a video via YouTube's private InnerTube `next`
 * endpoint — the same request the watch page makes to render the comments
 * section. Same-origin, so cookies/auth ride along (see {@link ./innertube}).
 *
 * Returns the "Top comments" (relevance-sorted, which is what the initial watch
 * page continuation selects) together with their like counts, so sentiment can
 * weight popular opinions correctly. One page is enough for a sentiment read;
 * we keep it to a single request for speed and robustness. Returns `[]` when
 * comments are disabled or can't be located rather than throwing.
 */
export class CommentsApi {
  async fetch(
    videoId: string,
    opts: { max?: number; signal?: AbortSignal } = {},
  ): Promise<VideoComment[]> {
    const max = opts.max ?? DEFAULT_MAX;
    const html = await fetchWatchPageHtml(videoId, opts.signal);

    const context = extractInnertubeContext(html);
    if (!context) throw new Error('INNERTUBE_CONTEXT not found');

    const initData = extractAssignedJson(html, 'ytInitialData');
    const continuation = initData
      ? this.findCommentsContinuation(initData)
      : null;
    if (!continuation) {
      log.info('no comments continuation (comments off or not found)');
      return [];
    }

    const auth = await buildAuthHeader();
    const headers = innertubeHeaders(auth ?? '', context);
    if (!auth) delete headers.authorization; // `next` works signed-out too.

    const data = await postInnertube(
      ENDPOINT,
      headers,
      { context, continuation },
      opts.signal,
    );
    const comments = this.collectCommentTexts(data, max);
    log.info(`fetched ${comments.length} comment(s)`);
    return comments;
  }

  /**
   * Locate the comments section's continuation token in `ytInitialData`: the
   * `itemSectionRenderer` tagged `comment-item-section` holds the token that
   * loads the comments.
   */
  private findCommentsContinuation(data: unknown): string | null {
    const walk = (node: unknown): string | null => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const found = walk(item);
          if (found) return found;
        }
        return null;
      }
      const isr = (node as Record<string, unknown>).itemSectionRenderer as
        | { sectionIdentifier?: string }
        | undefined;
      if (isr && isr.sectionIdentifier === 'comment-item-section') {
        const tokens = collectContinuationTokens(isr);
        if (tokens.length) return tokens[0] as string;
      }
      for (const v of Object.values(node)) {
        const found = walk(v);
        if (found) return found;
      }
      return null;
    };
    return walk(data);
  }

  /**
   * Pull comments (text + like count) out of a `next` response. Modern YouTube
   * stores them in `commentEntityPayload` (`properties.content.content` and
   * `toolbar.likeCountNotliked`); older markup uses `commentRenderer`
   * (`contentText` / `voteCount`). We read both, dedupe by text, and cap.
   */
  private collectCommentTexts(data: unknown, max: number): VideoComment[] {
    const out: VideoComment[] = [];
    const seen = new Set<string>();

    const push = (text: unknown, likes: unknown): void => {
      if (typeof text !== 'string') return;
      const t = text.trim();
      if (!t || seen.has(t) || out.length >= max) return;
      seen.add(t);
      out.push({ text: t, likes: this.parseCount(likes) });
    };

    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object' || out.length >= max) return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      const obj = node as Record<string, unknown>;

      const entity = obj.commentEntityPayload as
        | {
            properties?: { content?: { content?: unknown } };
            toolbar?: { likeCountNotliked?: unknown; likeCountA11y?: unknown };
          }
        | undefined;
      if (entity) {
        push(
          entity.properties?.content?.content,
          entity.toolbar?.likeCountNotliked ?? entity.toolbar?.likeCountA11y,
        );
      }

      const renderer = obj.commentRenderer as
        | {
            contentText?: { simpleText?: unknown; runs?: { text?: unknown }[] };
            voteCount?: { simpleText?: unknown };
          }
        | undefined;
      if (renderer?.contentText) {
        const ct = renderer.contentText;
        const likes = renderer.voteCount?.simpleText;
        if (typeof ct.simpleText === 'string') push(ct.simpleText, likes);
        else if (Array.isArray(ct.runs)) {
          push(
            ct.runs.map((r) => (typeof r.text === 'string' ? r.text : '')).join(''),
            likes,
          );
        }
      }

      for (const v of Object.values(obj)) walk(v);
    };

    walk(data);
    return out;
  }

  /** Parse YouTube's compact counts ("1.2K", "3M", "1,234") into a number. */
  private parseCount(value: unknown): number {
    if (typeof value === 'number') return Math.max(0, Math.floor(value));
    if (typeof value !== 'string') return 0;
    const m = value.trim().match(/^([\d.,]+)\s*([KMB])?/i);
    if (!m) return 0;
    const base = Number((m[1] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(base)) return 0;
    const mult =
      { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase()] ?? 1;
    return Math.round(base * mult);
  }
}
