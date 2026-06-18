/**
 * Helpers for reading YouTube URLs and the page DOM. Kept free of side effects
 * so they can be unit tested in isolation.
 */

/** Extract the `v` query param (the video id) from a YouTube watch URL. */
export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([\w-]{6,})/);
      if (shortsMatch) return shortsMatch[1] ?? null;
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null;
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the given URL is a watchable YouTube video page. */
export function isWatchUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

/** Matches an `m:ss` or `h:mm:ss` timestamp token. */
const TIMESTAMP_TOKEN = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

/** Collect every timestamp token in `text`, in order, as seconds. */
export function extractTimestampSeconds(text: string): number[] {
  const seconds: number[] = [];
  for (const match of text.matchAll(TIMESTAMP_TOKEN)) {
    const value = parseTimestamp(match[0]);
    if (value !== null) seconds.push(value);
  }
  return seconds;
}

/**
 * Extract ordered [start, end] second-pairs from free text such as the reply
 * from YouTube's Ask Gemini panel — e.g. `[["5:06","6:01"]]` or prose like
 * "from 5:06 to 6:01". Pairs tokens sequentially; a trailing token is dropped.
 */
export function parseTimestampPairs(text: string): [number, number][] {
  const seconds = extractTimestampSeconds(text);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < seconds.length; i += 2) {
    const start = seconds[i] as number;
    const end = seconds[i + 1] as number;
    if (end > start) pairs.push([start, end]);
  }
  return pairs;
}

/**
 * Return the slice of `text` following the n-th timestamp token. Used to skip
 * past the timestamps of earlier Ask-Gemini answers (which appear first in the
 * panel) and isolate the newest reply. `n <= 0` returns the whole string.
 */
export function sliceTextAfterNthTimestamp(text: string, n: number): string {
  if (n <= 0) return text;
  const re = new RegExp(TIMESTAMP_TOKEN.source, 'g');
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (++count === n) return text.slice(match.index + match[0].length);
  }
  return text;
}

/**
 * Parse a chapter timestamp like `1:02:03` or `4:21` into seconds.
 */
export function parseTimestamp(value: string): number | null {
  const parts = value.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    const [h, m, s] = parts as [number, number, number];
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    return m * 60 + s;
  }
  return null;
}
