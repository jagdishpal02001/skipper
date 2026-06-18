import type { AskGeminiDriver } from '@/providers';
import { createLogger } from '@/utils/logger';
import { deriveAskQueryContinuation } from '@/utils/protobuf';

const log = createLogger('ask-gemini-api');

const ORIGIN = 'https://www.youtube.com';
const ENDPOINT = `${ORIGIN}/youtubei/v1/get_panel?prettyPrint=false`;

/**
 * Cookies Google's own client JS reads to compute the SAPISIDHASH auth header.
 * Mapped to the header label InnerTube expects for each.
 */
const AUTH_COOKIES: [label: string, cookie: string][] = [
  ['SAPISIDHASH', 'SAPISID'],
  ['SAPISID1PHASH', '__Secure-1PAPISID'],
  ['SAPISID3PHASH', '__Secure-3PAPISID'],
];

interface InnertubeContext {
  client: { clientVersion?: string; visitorData?: string };
}

/**
 * Asks YouTube's "Ask about this video" Gemini by calling the same InnerTube
 * endpoint (`/youtubei/v1/get_panel`) the page itself uses — no DOM, so no
 * scrolling, no panel flash, no typing. Runs in the content script so the
 * request is same-origin and the browser attaches the auth cookies; we compute
 * the matching SAPISIDHASH header ourselves.
 *
 * Best-effort: if the user isn't logged in, the continuation can't be found, or
 * YouTube rejects the request, it throws and the provider falls back to the DOM
 * driver.
 */
export class AskGeminiApi implements AskGeminiDriver {
  readonly id = 'api';

  isAvailable(): boolean {
    // Needs a logged-in session — SAPISID is what we hash for auth.
    return Boolean(this.getCookie('SAPISID'));
  }

  async ask(prompt: string, videoId: string, signal?: AbortSignal): Promise<string> {
    const { context, continuation: openContinuation } = await this.bootstrap(
      videoId,
      signal,
    );
    const authorization = await this.buildAuthHeader();
    if (!authorization) throw new Error('not logged in (no SAPISID cookie)');
    const headers = this.headers(authorization, context);

    // Turn the page's "open panel" continuation into a "send question" one by
    // stripping its init flag — exactly what YouTube does when you type.
    const queryContinuation = deriveAskQueryContinuation(openContinuation);
    if (!queryContinuation) {
      throw new Error('could not derive query continuation');
    }

    // 1. Open the panel: establishes the chat session + a consistency token.
    const openData = await this.post(
      headers,
      { context, continuation: openContinuation },
      signal,
    );
    const token = this.consistencyToken(openData);

    // 2. Send the question with the derived continuation + our prompt.
    const sendContext = token ? this.withConsistency(context, token) : context;
    const sendData = await this.post(
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

  private headers(
    authorization: string,
    context: InnertubeContext,
  ): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization,
      'x-origin': ORIGIN,
      'x-youtube-client-name': '1',
      'x-youtube-client-version': context.client.clientVersion ?? '',
      ...(context.client.visitorData
        ? { 'x-goog-visitor-id': context.client.visitorData }
        : {}),
    };
  }

  private async post(
    headers: Record<string, string>,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`get_panel HTTP ${res.status}`);
    return res.json();
  }

  // ---- bootstrap (context + continuation from the watch page) -----------

  private async bootstrap(
    videoId: string,
    signal?: AbortSignal,
  ): Promise<{ context: InnertubeContext; continuation: string }> {
    const res = await fetch(`${ORIGIN}/watch?v=${videoId}`, {
      credentials: 'include',
      signal,
    });
    const html = await res.text();

    const context = this.extractInnertubeContext(html);
    if (!context) throw new Error('INNERTUBE_CONTEXT not found');

    const initData = this.extractAssignedJson(html, 'ytInitialData');
    const continuation = initData
      ? this.findYouChatContinuation(initData)
      : null;
    if (!continuation) throw new Error('YouChat continuation not found');

    return { context, continuation };
  }

  private extractInnertubeContext(html: string): InnertubeContext | null {
    const key = '"INNERTUBE_CONTEXT":';
    const i = html.indexOf(key);
    if (i < 0) return null;
    const braceIdx = html.indexOf('{', i + key.length);
    const json = this.extractBalancedJson(html, braceIdx);
    return json as InnertubeContext | null;
  }

  private extractAssignedJson(html: string, name: string): unknown {
    const markers = [
      `var ${name} = `,
      `window["${name}"] = `,
      `${name} = `,
    ];
    for (const marker of markers) {
      const i = html.indexOf(marker);
      if (i < 0) continue;
      const braceIdx = html.indexOf('{', i + marker.length);
      if (braceIdx < 0) continue;
      const json = this.extractBalancedJson(html, braceIdx);
      if (json) return json;
    }
    return null;
  }

  /** Parse the balanced-brace JSON object starting at `start` (the '{'). */
  private extractBalancedJson(text: string, start: number): unknown {
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
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  /**
   * Find the continuation token that loads the YouChat ("Ask about this video")
   * panel. Robust to YouTube's panel structure: it collects every
   * `continuationCommand.token` and returns the first whose decoded protobuf
   * contains "youchat" (the panel id "PAyouchat" is embedded in it).
   */
  private findYouChatContinuation(data: unknown): string | null {
    const tokens: string[] = [];
    this.collectTokens(data, tokens);
    for (const token of tokens) {
      try {
        if (/youchat/i.test(this.b64decode(token))) return token;
      } catch {
        // not base64 / not decodable — skip
      }
    }
    return null;
  }

  private collectTokens(node: unknown, out: string[]): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) this.collectTokens(item, out);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (
        k === 'continuationCommand' &&
        v &&
        typeof v === 'object' &&
        typeof (v as { token?: unknown }).token === 'string'
      ) {
        out.push((v as { token: string }).token);
      }
      this.collectTokens(v, out);
    }
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

  // ---- auth -------------------------------------------------------------

  private async buildAuthHeader(): Promise<string | null> {
    const ts = Math.floor(Date.now() / 1000);
    const parts: string[] = [];
    for (const [label, cookie] of AUTH_COOKIES) {
      const value = this.getCookie(cookie);
      if (!value) continue;
      const hash = await this.sha1Hex(`${ts} ${value} ${ORIGIN}`);
      parts.push(`${label} ${ts}_${hash}`);
    }
    return parts.length ? parts.join(' ') : null;
  }

  private async sha1Hex(input: string): Promise<string> {
    const buf = await crypto.subtle.digest(
      'SHA-1',
      new TextEncoder().encode(input),
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ---- helpers ----------------------------------------------------------

  private getCookie(name: string): string | null {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${escaped}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1] as string) : null;
  }

  private b64decode(token: string): string {
    const normalized = decodeURIComponent(token)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return atob(normalized);
  }
}
