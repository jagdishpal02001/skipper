/**
 * Shared low-level helpers for talking to YouTube's private InnerTube API from
 * the content script. Both {@link AskGeminiApi} (get_panel) and
 * {@link CommentsApi} (next) build on these — same-origin `fetch`, the page's
 * own `INNERTUBE_CONTEXT`, and the SAPISIDHASH auth header Google's client JS
 * computes from the session cookies.
 *
 * Everything here is best-effort: if the user isn't signed in, or YouTube's
 * markup shifts, the extractors return null/empty and callers fall back.
 */

export const YT_ORIGIN = 'https://www.youtube.com';

export interface InnertubeContext {
  client: { clientVersion?: string; visitorData?: string };
}

/**
 * Cookies Google's own client JS reads to compute the SAPISIDHASH auth header,
 * mapped to the header label InnerTube expects for each.
 */
const AUTH_COOKIES: [label: string, cookie: string][] = [
  ['SAPISIDHASH', 'SAPISID'],
  ['SAPISID1PHASH', '__Secure-1PAPISID'],
  ['SAPISID3PHASH', '__Secure-3PAPISID'],
];

export function getCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1] as string) : null;
}

/** True when a signed-in session exists (SAPISID is what we hash for auth). */
export function isSignedIn(): boolean {
  return Boolean(getCookie('SAPISID'));
}

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compute the `Authorization: SAPISIDHASH …` header, or null if signed out. */
export async function buildAuthHeader(): Promise<string | null> {
  const ts = Math.floor(Date.now() / 1000);
  const parts: string[] = [];
  for (const [label, cookie] of AUTH_COOKIES) {
    const value = getCookie(cookie);
    if (!value) continue;
    const hash = await sha1Hex(`${ts} ${value} ${YT_ORIGIN}`);
    parts.push(`${label} ${ts}_${hash}`);
  }
  return parts.length ? parts.join(' ') : null;
}

export function innertubeHeaders(
  authorization: string,
  context: InnertubeContext,
): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization,
    'x-origin': YT_ORIGIN,
    'x-youtube-client-name': '1',
    'x-youtube-client-version': context.client.clientVersion ?? '',
    ...(context.client.visitorData
      ? { 'x-goog-visitor-id': context.client.visitorData }
      : {}),
  };
}

export async function postInnertube(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`InnerTube HTTP ${res.status} (${endpoint})`);
  return res.json();
}

/** How long a downloaded watch page is reused before fetching it again. */
const WATCH_PAGE_TTL_MS = 5 * 60 * 1000;

let watchPage: {
  videoId: string;
  fetchedAt: number;
  html: Promise<string>;
} | null = null;

/**
 * Same-origin fetch of a watch page's HTML (carries context + init data).
 *
 * The most recent video's page is reused for a few minutes: the comments fetch
 * and every Ask Gemini question (sponsors, sentiment, its retry) need the same
 * ~1 MB page, which otherwise got downloaded up to four times per video. The
 * shared download isn't tied to any one caller's signal — an aborting caller
 * just stops waiting for it.
 */
export function fetchWatchPageHtml(
  videoId: string,
  signal?: AbortSignal,
): Promise<string> {
  let entry = watchPage;
  if (
    !entry ||
    entry.videoId !== videoId ||
    Date.now() - entry.fetchedAt > WATCH_PAGE_TTL_MS
  ) {
    const fresh = {
      videoId,
      fetchedAt: Date.now(),
      html: downloadWatchPage(videoId),
    };
    // Never serve a failed download to the next caller.
    fresh.html.catch(() => {
      if (watchPage === fresh) watchPage = null;
    });
    watchPage = entry = fresh;
  }
  return untilAborted(entry.html, signal);
}

async function downloadWatchPage(videoId: string): Promise<string> {
  const res = await fetch(`${YT_ORIGIN}/watch?v=${videoId}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`watch page HTTP ${res.status}`);
  return res.text();
}

/** Settle with `promise`, or reject as soon as `signal` aborts. */
function untilAborted<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export function extractInnertubeContext(html: string): InnertubeContext | null {
  const key = '"INNERTUBE_CONTEXT":';
  const i = html.indexOf(key);
  if (i < 0) return null;
  const braceIdx = html.indexOf('{', i + key.length);
  return extractBalancedJson(html, braceIdx) as InnertubeContext | null;
}

/** Parse a `var X = { … }` / `window["X"] = { … }` assignment out of HTML/JS. */
export function extractAssignedJson(html: string, name: string): unknown {
  const markers = [`var ${name} = `, `window["${name}"] = `, `${name} = `];
  for (const marker of markers) {
    const i = html.indexOf(marker);
    if (i < 0) continue;
    const braceIdx = html.indexOf('{', i + marker.length);
    if (braceIdx < 0) continue;
    const json = extractBalancedJson(html, braceIdx);
    if (json) return json;
  }
  return null;
}

/** Parse the balanced-brace JSON object starting at `start` (the '{'). */
export function extractBalancedJson(text: string, start: number): unknown {
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

/** Collect every `continuationCommand.token` string reachable in a tree. */
export function collectContinuationTokens(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectContinuationTokens(item, out);
    return out;
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
    collectContinuationTokens(v, out);
  }
  return out;
}

/** URL-safe base64 → binary string (best-effort; throws if not decodable). */
export function b64decodeToken(token: string): string {
  const normalized = decodeURIComponent(token)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return atob(normalized);
}
