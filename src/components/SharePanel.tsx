import { useState } from 'react';
import {
  shareLink,
  shareMessage,
  shareUrl,
  type ShareChannel,
  type ShareStats,
} from '@/utils/growth';

const CHANNELS: {
  id: Exclude<ShareChannel, 'copy'>;
  label: string;
  color: string;
}[] = [
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366' },
  { id: 'x', label: 'X', color: '#e7e9ea' },
  { id: 'telegram', label: 'Telegram', color: '#2aabee' },
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'reddit', label: 'Reddit', color: '#ff4500' },
  { id: 'email', label: 'Email', color: '#9ca3af' },
];

/**
 * "Share Skipper" buttons. Each opens that app's own share page with a short
 * blurb — personalized with the user's stats when given — and a store link
 * tagged with the channel, so shares show up in the listing's analytics.
 * Nothing is sent anywhere unless the user picks a channel.
 */
export function SharePanel({ stats }: { stats?: ShareStats | null }) {
  const [copied, setCopied] = useState(false);
  const text = shareMessage(stats);

  const copy = async () => {
    await navigator.clipboard.writeText(`${text} ${shareUrl('copy')}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="mb-2.5 rounded-lg bg-surface-700/60 p-2.5 text-xs leading-relaxed text-gray-300">
        {text}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {CHANNELS.map((c) => (
          <a
            key={c.id}
            href={shareLink(c.id, text)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-surface-700/40 px-2 py-1.5 text-[11px] font-semibold text-gray-200 transition-colors hover:border-white/15 hover:bg-surface-700"
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => void copy()}
          className="col-span-2 rounded-lg border border-brand-500/40 bg-brand-500/15 px-2 py-1.5 text-[11px] font-semibold text-brand-400 transition-colors hover:bg-brand-500/25"
        >
          {copied ? 'Copied!' : 'Copy message & link'}
        </button>
      </div>
    </div>
  );
}
