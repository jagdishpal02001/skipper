import type { SponsorSegment } from '@/types';
import { createLogger } from '@/utils/logger';
import { parseTimestampPairs } from '@/utils/youtube';
import type { AskGeminiDriver, ProviderContext, SegmentProvider } from './types';

const log = createLogger('provider:ask-gemini');

/**
 * The prompt sent to YouTube's "Ask about this video" panel.
 *
 * Deliberately uses the literal placeholder `MM:SS` instead of numeric example
 * timestamps: that way the prompt echo in the panel contributes no digits, so
 * any `m:ss` token we later read back belongs to the model's real answer.
 */
const ASK_PROMPT =
  'List the start and end timestamps of every sponsored, advertisement, ' +
  'affiliate, paid-promotion or discount-code segment in this video. ' +
  'Respond with ONLY a JSON array of [start, end] pairs in MM:SS format, ' +
  'for example [["MM:SS","MM:SS"]]. If there are none, respond with []. ' +
  'Do not include any other text or explanation.';

/**
 * Resolves sponsor segments by querying YouTube's built-in Gemini panel.
 * 
 * Tries the available drivers in order (typically the same-origin InnerTube API
 * first to avoid UI disruption, falling back to driving the DOM panel).
 * Responsible for prompting and parsing the returned timestamps into segments.
 */
export class AskGeminiProvider implements SegmentProvider {
  readonly id = 'ask-gemini';
  readonly label = 'Ask Gemini (YouTube)';

  constructor(private readonly drivers: AskGeminiDriver[]) {}

  isAvailable(): boolean {
    return this.drivers.some((d) => d.isAvailable());
  }

  async getSegments(ctx: ProviderContext): Promise<SponsorSegment[]> {
    const max = ctx.metadata.durationSeconds || Number.MAX_SAFE_INTEGER;
    let lastError: unknown;

    for (const driver of this.drivers) {
      if (!driver.isAvailable()) continue;
      try {
        log.info(`asking via "${driver.id}"`);
        const reply = await driver.ask(
          ASK_PROMPT,
          ctx.metadata.videoId,
          ctx.signal,
        );
        const pairs = parseTimestampPairs(reply);
        log.info(`"${driver.id}" → ${pairs.length} segment(s)`);
        return this.toSegments(pairs, max);
      } catch (error) {
        if (ctx.signal?.aborted) throw error;
        lastError = error;
        log.warn(`driver "${driver.id}" failed, trying next`, error);
      }
    }

    throw lastError ?? new Error('No Ask Gemini backend available');
  }

  private toSegments(
    pairs: [number, number][],
    max: number,
  ): SponsorSegment[] {
    return pairs
      .filter(([start]) => start < max)
      .map(([start, end]) => ({
        start,
        end: Math.min(end, max),
        type: 'sponsor' as const,
        // No confidence is returned; assume high but below 1 so the user's
        // threshold can still exclude it if they raise it.
        confidence: 0.9,
        source: this.id,
      }));
  }
}
