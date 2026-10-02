import { useState } from 'react';
import { Card, SharePanel, Toggle } from '@/components';
import {
  useActiveVideo,
  useCacheInfo,
  useSettings,
  useUsageStats,
} from '@/hooks';
import { VideoStatus } from './VideoStatus';
import { SettingsPanel } from './SettingsPanel';
import { SystemPanel } from './SystemPanel';
import { UsagePanel } from './UsagePanel';
import { SentimentPanel } from './SentimentPanel';
import { RatePrompt } from './RatePrompt';

/**
 * Root popup view. Composes the status, settings and cache sections and owns
 * the master enable switch. All data flows through the hooks, which talk to the
 * background worker / content script.
 */
export function Popup() {
  const { settings, loading, update } = useSettings();
  const video = useActiveVideo();
  const cache = useCacheInfo();
  // All-time totals personalize the share blurb and gate the rating ask.
  const { summary } = useUsageStats(0);
  const [showShare, setShowShare] = useState(false);

  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
          S
        </span>
        <div className="flex-1">
          <h1 className="text-sm font-semibold leading-tight text-white">
            Skipper
          </h1>
          <p className="text-[11px] text-gray-400">AI sponsor skipping</p>
        </div>
        <button
          type="button"
          onClick={() => setShowShare((v) => !v)}
          title="Share Skipper with a friend"
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            showShare
              ? 'border-brand-500 bg-brand-500/20 text-brand-400'
              : 'border-white/10 text-gray-300 hover:bg-white/5'
          }`}
        >
          ♥ Share
        </button>
        <Toggle
          label=""
          checked={settings.enabled}
          disabled={loading}
          onChange={(enabled) => void update({ enabled })}
        />
      </header>

      {showShare && (
        <Card title="Share Skipper with a friend">
          <SharePanel stats={summary?.allTime} />
        </Card>
      )}
      <RatePrompt skipCount={summary?.allTime.skipCount ?? 0} />

      <VideoStatus video={video} enabled={settings.enabled} />
      <SentimentPanel video={video} />
      <UsagePanel />
      <SettingsPanel settings={settings} onUpdate={(p) => void update(p)} />
      <SystemPanel cache={cache} />

      <div className="px-2.5 py-2 rounded-lg bg-surface-800 border border-white/5 text-[10px] text-gray-400 leading-relaxed">
        <p className="font-semibold text-gray-300 mb-0.5 flex items-center gap-1">
          <span>💡</span> AI Advisory
        </p>
        Skipping works for everyone via the SponsorBlock community database.
        Signed in to YouTube, Skipper also uses YouTube&apos;s built-in Gemini for
        videos the community hasn&apos;t covered yet — AI timestamps may
        occasionally be off.
      </div>

      <footer className="pt-1 text-center text-[10px] text-gray-600">
        Skipper AI · analyzes videos on demand with Gemini
      </footer>
    </div>
  );
}
