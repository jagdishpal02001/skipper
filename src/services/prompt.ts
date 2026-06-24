import type { SegmentType, Transcript, VideoMetadata } from '@/types';
import { formatTimestamp } from '@/utils/time';

/** The valid segment type literals, embedded into the prompt and validator. */
export const SEGMENT_TYPES: readonly SegmentType[] = [
  'sponsor',
  'self_promo',
  'affiliate',
  'vpn',
  'course',
  'software',
  'product',
  'discount_code',
  'intro',
  'outro',
] as const;

/** Hard cap on characters sent to the model, to bound cost on long videos. */
const MAX_TRANSCRIPT_CHARS = 200_000;

export const SYSTEM_INSTRUCTION = `You are analyzing a YouTube video transcript.

Your task is to identify all sponsorship, advertisement, affiliate marketing, discount code promotions, product promotions, software promotions, VPN advertisements, course promotions, and paid partnerships.

Return ONLY valid JSON. No markdown, no code fences, no commentary.

Format:
{
  "segments": [
    { "start": 306, "end": 361, "type": "sponsor", "confidence": 0.95 }
  ]
}

Rules:
- Return timestamps in seconds (integers).
- "type" must be one of: ${SEGMENT_TYPES.join(', ')}.
- "confidence" is a number between 0 and 1.
- Only include actual promotional content.
- Do not include normal educational or editorial content.
- Do not include the intro unless it is itself promotional.
- "end" must be greater than "start"; segments must not overlap.
- If there is no promotional content, return {"segments": []}.
- **Whole-Video Advertisements**: If the entire video (or more than 90% of it) is a paid review, standalone ad, product demonstration, or promotional showcase, return a single segment starting at 0 and ending at the total duration of the video.
- **Teasers & Repeated Plugs**: If the creator briefly teases a sponsor at the start and then does a detailed segment later, return them as separate segments.
- **Keywords**: Pay close attention to transition signals like "sponsored by", "brought to you by", "use code", "discount link", "check out my partner", and names of common sponsors.
- Output valid JSON only.`;

/**
 * Serialise a transcript with inline timestamps so the model can produce
 * accurate boundaries. Falls back to metadata (description, chapters, comments)
 * when no transcript is available.
 */
export function buildUserPrompt(
  metadata: VideoMetadata,
  transcript: Transcript | null,
): string {
  const header = [
    `Title: ${metadata.title}`,
    `Channel: ${metadata.channel}`,
    metadata.durationSeconds
      ? `Duration: ${formatTimestamp(metadata.durationSeconds)} (${metadata.durationSeconds}s)`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  if (transcript && transcript.segments.length > 0) {
    const body = serializeTranscript(transcript);
    return `${header}\nTranscript source: ${transcript.source}\n\nTranscript (each line is "[seconds] text"):\n${body}`;
  }

  // No transcript — assemble whatever metadata we have.
  const parts: string[] = [header, '\nNo transcript available. Use metadata:'];
  if (metadata.chapters?.length) {
    parts.push(
      'Chapters:\n' +
        metadata.chapters
          .map((c) => `[${c.startSeconds}] ${c.title}`)
          .join('\n'),
    );
  }
  if (metadata.description) {
    parts.push(`Description:\n${truncate(metadata.description, 8000)}`);
  }
  if (metadata.topComments?.length) {
    parts.push(
      'Top comments:\n' +
        metadata.topComments.map((c) => `- ${truncate(c, 500)}`).join('\n'),
    );
  }
  parts.push(
    '\nWith no transcript, infer likely sponsor windows from chapter titles and the description (e.g. discount codes / affiliate links). Lower the confidence accordingly.',
  );
  return parts.join('\n');
}

function serializeTranscript(transcript: Transcript): string {
  const lines = transcript.segments.map(
    (s) => `[${Math.round(s.start)}] ${s.text.replace(/\s+/g, ' ').trim()}`,
  );
  let text = lines.join('\n');
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    // Keep a representative sample: down-sample lines evenly across the video
    // so we never blow the budget on an 8-hour stream.
    const ratio = MAX_TRANSCRIPT_CHARS / text.length;
    const step = Math.ceil(1 / ratio);
    text = lines.filter((_, i) => i % step === 0).join('\n');
  }
  return text;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
