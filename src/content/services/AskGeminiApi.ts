import type { AskGeminiDriver } from '@/providers';
import { createLogger } from '@/utils/logger';
import { deriveAskQueryContinuation } from '@/utils/protobuf';
import {
  YT_ORIGIN,
  b64decodeToken,
  buildAuthHeader,
  collectContinuationTokens,
  extractAssignedJson,
  extractInnertubeContext,
  innertubeHeaders,
  isSignedIn,
  postInnertube,
  fetchWatchPageHtml,
  type InnertubeContext,
} from './innertube';

const log = createLogger('ask-gemini-api');

const ENDPOINT = `${YT_ORIGIN}/youtubei/v1/get_panel?prettyPrint=false`;

/**
 * Asks YouTube's "Ask about this video" Gemini by calling the same InnerTube
 * endpoint (`/youtubei/v1/get_panel`) the page itself uses — no DOM, so no
 * scrolling, no panel flash, no typing. Runs in the content script so the
 * request is same-origin and the browser attaches the auth cookies; we compute
 * the matching SAPISIDHASH header ourselves (see {@link ./innertube}).
 *
 * Best-effort: if the user isn't logged in, the continuation can't be found, or
 * YouTube rejects the request, it throws and the provider falls back to the DOM
 * driver.
 */
export class AskGeminiApi implements AskGeminiDriver {
  readonly id = 'api';

  isAvailable(): boolean {
    // Needs a logged-in session — SAPISID is what we hash for auth.
    return isSignedIn();
  }

  async ask(prompt: string, videoId: string, signal?: AbortSignal): Promise<string> {
    const { context, continuation: openContinuation } = await this.bootstrap(
      videoId,
      signal,
    );
    const authorization = await buildAuthHeader();
    if (!authorization) throw new Error('not logged in (no SAPISID cookie)');
    const headers = innertubeHeaders(authorization, context);

    // Turn the page's "open panel" continuation into a "send question" one by
    // stripping its init flag — exactly what YouTube does when you type.
    const queryContinuation = deriveAskQueryContinuation(openContinuation);
    if (!queryContinuation) {
      throw new Error('could not derive query continuation');
    }

    // 1. Open the panel: establishes the chat session + a consistency token.
    const openData = await postInnertube(
      ENDPOINT,
      headers,
      { context, continuation: openContinuation },
      signal,
    );
    const token = this.consistencyToken(openData);

    // 2. Send the question with the derived continuation + our prompt.
    const sendContext = token ? this.withConsistency(context, token) : context;
    const sendData = await postInnertube(
      ENDPOINT,
      headers,
      {
        context: sendContext,
        continuation: queryContinuation,
        formData: {
          inputComposerFormData: {
            clientMessageId: `youchat-${Date.now()}`,
            playerOffsetMs: '0',
            userInputText: prompt,
          },
        },
      },
      signal,
    );

    const answer = this.extractAnswer(sendData);
    log.info('reply', answer.slice(0, 300));
    if (!answer.trim()) throw new Error('no answer text in get_panel response');
    return answer;
  }

  private consistencyToken(data: unknown): string | null {
    const jar = (data as {
      responseContext?: { consistencyTokenJar?: { encryptedTokenJarContents?: unknown } };
    })?.responseContext?.consistencyTokenJar?.encryptedTokenJarContents;
    return typeof jar === 'string' ? jar : null;
  }

  private withConsistency(
    context: InnertubeContext,
    token: string,
  ): InnertubeContext {
    const request = {
      ...((context as { request?: object }).request ?? {}),
      useSsl: true,
      consistencyTokenJars: [{ encryptedTokenJarContents: token }],
    };
    return { ...context, request } as InnertubeContext;
  }

  // ---- bootstrap (context + continuation from the watch page) -----------

  private async bootstrap(
    videoId: string,
    signal?: AbortSignal,
  ): Promise<{ context: InnertubeContext; continuation: string }> {
    const html = await fetchWatchPageHtml(videoId, signal);

    const context = extractInnertubeContext(html);
    if (!context) throw new Error('INNERTUBE_CONTEXT not found');

    const initData = extractAssignedJson(html, 'ytInitialData');
    const continuation = initData
      ? this.findYouChatContinuation(initData)
      : null;
    if (!continuation) throw new Error('YouChat continuation not found');

    return { context, continuation };
  }

  /**
   * Find the continuation token that loads the YouChat ("Ask about this video")
   * panel: the first collected `continuationCommand.token` whose decoded
   * protobuf contains "youchat" (the panel id "PAyouchat" is embedded in it).
   */
  private findYouChatContinuation(data: unknown): string | null {
    for (const token of collectContinuationTokens(data)) {
      try {
        if (/youchat/i.test(b64decodeToken(token))) return token;
      } catch {
        // not base64 / not decodable — skip
      }
    }
    return null;
  }

  // ---- response parsing -------------------------------------------------

  /** Concatenate every chat item's text (the assistant reply contains it). */
  private extractAnswer(data: unknown): string {
    const parts: string[] = [];
    this.collectChatText(data, parts);
    return parts.join('\n');
  }

  private collectChatText(node: unknown, out: string[]): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) this.collectChatText(item, out);
      return;
    }
    const vm = (node as Record<string, unknown>).youChatItemViewModel;
    if (vm && typeof vm === 'object') {
      const content = (vm as { text?: { content?: unknown } }).text?.content;
      if (typeof content === 'string') out.push(content);
    }
    for (const v of Object.values(node)) this.collectChatText(v, out);
  }
}
