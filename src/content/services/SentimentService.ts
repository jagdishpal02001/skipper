import type { AskGeminiDriver } from '@/providers';
import type { VideoComment, VideoSentiment } from '@/types';
import { createLogger } from '@/utils/logger';
import { clamp } from '@/utils/time';
import { extractBalancedJson } from './innertube';
import type { CommentsApi } from './CommentsApi';

const log = createLogger('sentiment');

/** Keep the prompt bounded regardless of how chatty commenters are. */
const MAX_COMMENTS = 40;
const MAX_COMMENT_CHARS = 280;

export interface SentimentOptions {
  signal?: AbortSignal;
  /**
   * Restrict the cascade to the silent InnerTube API driver. Used by the
   * automatic on-page badge: auto-runs must never fall back to driving the DOM
   * panel, which would visibly open it on every video the user watches.
   */
  apiOnly?: boolean;
}

/**
 * Produces an audience-sentiment verdict for a video by fetching its top
 * comments ({@link CommentsApi}) and asking YouTube's "Ask about this video"
 * Gemini to score them. Comments carry their like counts and the prompt
 * instructs Gemini to weight by them — a comment with thousands of likes
 * speaks for thousands of viewers, so the verdict reflects the audience, not
 * just whoever happened to comment.
 *
 * Reuses the same driver cascade as the sponsor-segment provider (InnerTube
 * API first, DOM panel fallback — unless {@link SentimentOptions.apiOnly}).
 */
export class SentimentService {
  constructor(
    private readonly drivers: AskGeminiDriver[],
    private readonly comments: CommentsApi,
  ) {}

  isAvailable(): boolean {
    return this.drivers.some((d) => d.isAvailable());
  }

  async analyze(
    videoId: string,
    opts: SentimentOptions = {},
  ): Promise<VideoSentiment> {
    const comments = await this.comments.fetch(videoId, {
      max: MAX_COMMENTS,
      signal: opts.signal,
    });
    if (comments.length === 0) {
      throw new Error('No comments available to analyze for this video');
    }

    return this.askAndParse(comments, videoId, opts);
  }

  /**
   * Run the driver cascade with refusal-aware retries. YouTube's YouChat is
   * guardrailed to Q&A "about this video" and sometimes declines bulk-looking
   * tasks ("I can't fulfill that type of request") — nondeterministically, and
   * more often via the API surface than the panel. So per driver we try up to
   * two phrasings of the same request before moving to the next driver.
   */
  private async askAndParse(
    comments: VideoComment[],
    videoId: string,
    opts: SentimentOptions,
  ): Promise<VideoSentiment> {
    const drivers = opts.apiOnly
      ? this.drivers.filter((d) => d.id === 'api')
      : this.drivers;
    const prompts = [
      this.buildPrompt(comments),
      this.buildRetryPrompt(comments),
    ];

    let lastError: unknown;
    for (const driver of drivers) {
      if (!driver.isAvailable()) continue;
      for (const [i, prompt] of prompts.entries()) {
        try {
          log.info(`asking sentiment via "${driver.id}" (attempt ${i + 1})`);
          const reply = await driver.ask(prompt, videoId, opts.signal);
          if (this.isRefusal(reply)) {
            throw new Error('Ask Gemini declined the request');
          }
          return this.parse(reply, videoId, comments.length);
        } catch (error) {
          if (opts.signal?.aborted) throw error;
          lastError = error;
          log.warn(
            `driver "${driver.id}" attempt ${i + 1} failed, trying next`,
            error,
          );
        }
      }
    }
    throw lastError ?? new Error('No Ask Gemini backend available');
  }

  /** The standard YouChat guardrail responses when it declines a request. */
  private isRefusal(reply: string): boolean {
    return /\b(?:can\s?not|can'?t|unable to)\s+(?:fulfill|help with|assist with|complete)\b/i.test(
      reply,
    );
  }

  private commentList(comments: VideoComment[]): string {
    return comments
      .map((c, i) => {
        const text = c.text.replace(/\s+/g, ' ').slice(0, MAX_COMMENT_CHARS);
        const likes = c.likes > 0 ? ` [${c.likes} likes]` : '';
        return `${i + 1}.${likes} ${text}`;
      })
      .join('\n');
  }

  /**
   * Primary phrasing: a question *about this video's reception*, so it reads
   * as in-scope video Q&A rather than a pasted-text bulk task (which the
   * guardrails are more likely to decline).
   *
   * Crucially, it asks for each comment's *stance toward the video*, not its
   * emotional tone. Viewers of a video criticising X often vent anger at X in
   * the comments while fully agreeing with the video — naive tone analysis
   * scores that "negative" and tanks the rating, when the video is actually
   * being received extremely well.
   */
  private buildPrompt(comments: VideoComment[]): string {
    return (
      'How is this video itself being received by its viewers? These are its ' +
      'top comments, each with its like count — weight opinions by likes, ' +
      'since a highly-liked comment speaks for many viewers:\n\n' +
      `${this.commentList(comments)}\n\n` +
      "Judge each comment's stance TOWARD THE VIDEO AND ITS CREATOR, not the " +
      "comment's emotional tone. A comment that is angry or sad about " +
      'something the video criticises or reports, while agreeing with the ' +
      'video, counts as POSITIVE reception. Count a comment as negative only ' +
      'if it criticises the video itself or its creator — e.g. calls it ' +
      'wrong, misleading, clickbait, low quality, or boring.\n' +
      'Summarize the reception as a JSON object, in exactly this shape and ' +
      'nothing else:\n' +
      '{"rating": <number 0-10, how well the audience received the video>, ' +
      '"positivePct": <% of viewers approving of the video>, ' +
      '"negativePct": <% criticising the video or creator>, ' +
      '"neutralPct": <% neutral or unrelated>, ' +
      '"summary": "<one or two sentences on how viewers received the video>"}\n' +
      'The three percentages should add up to about 100.'
    );
  }

  /** Second phrasing for the retry — shorter, plainer, fewer comments. */
  private buildRetryPrompt(comments: VideoComment[]): string {
    return (
      'Question about this video: judging by these viewer comments, do ' +
      'viewers approve of this video and its creator, or are they ' +
      'criticising the video itself? (Anger at what the video criticises ' +
      'counts as approval of the video, not disapproval.)\n\n' +
      `${this.commentList(comments.slice(0, 20))}\n\n` +
      'Answer with just this JSON: {"rating": <0-10>, "positivePct": <0-100>, ' +
      '"negativePct": <0-100>, "neutralPct": <0-100>, "summary": "<short>"}'
    );
  }

  /** Defensively parse the model's reply into a clamped {@link VideoSentiment}. */
  private parse(
    reply: string,
    videoId: string,
    sampleSize: number,
  ): VideoSentiment {
    const start = reply.indexOf('{');
    const obj = start >= 0 ? extractBalancedJson(reply, start) : null;
    if (!obj || typeof obj !== 'object') {
      throw new Error('Could not parse sentiment from the response');
    }
    const raw = obj as Record<string, unknown>;
    const num = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    let positive = clamp(num(raw.positivePct), 0, 100);
    let negative = clamp(num(raw.negativePct), 0, 100);
    let neutral = clamp(num(raw.neutralPct), 0, 100);
    // Normalise the split to 100% if the model's numbers don't add up.
    const sum = positive + negative + neutral;
    if (sum > 0 && Math.abs(sum - 100) > 1) {
      positive = Math.round((positive / sum) * 100);
      negative = Math.round((negative / sum) * 100);
      neutral = 100 - positive - negative;
    }

    return {
      videoId,
      rating: Math.round(clamp(num(raw.rating), 0, 10) * 10) / 10,
      positivePct: positive,
      negativePct: negative,
      neutralPct: neutral,
      summary:
        typeof raw.summary === 'string' ? raw.summary.trim() : '',
      sampleSize,
      createdAt: Date.now(),
    };
  }
}
