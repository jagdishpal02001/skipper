import type { SponsorSegment } from '@/types';
import { formatTimestamp } from '@/utils/time';

const LABELS: Record<string, string> = {
  sponsor: 'Sponsor',
  self_promo: 'Self promo',
  affiliate: 'Affiliate',
  vpn: 'VPN',
  course: 'Course',
  software: 'Software',
  product: 'Product',
  discount_code: 'Discount code',
  intro: 'Intro',
  outro: 'Outro',
};

/** Read-only list of detected segments, shared between popup contexts. */
export function SegmentList({ segments }: { segments: SponsorSegment[] }) {
  if (!segments.length) {
    return (
      <p className="py-2 text-xs text-gray-400">No sponsor segments detected.</p>
    );
  }
  return (
    <ul className="max-h-44 space-y-1 overflow-y-auto">
      {segments.map((s, i) => (
        <li
          key={`${s.start}-${i}`}
          className="flex items-center justify-between rounded-md bg-surface-700 px-2 py-1.5 text-xs"
        >
          <span className="text-gray-300">
            {LABELS[s.type] ?? s.type}
            <span className="ml-1 text-gray-500">
              {Math.round(s.confidence * 100)}%
            </span>
          </span>
          <span className="tabular-nums text-gray-200">
            {formatTimestamp(s.start)} → {formatTimestamp(s.end)}
          </span>
        </li>
      ))}
    </ul>
  );
}
