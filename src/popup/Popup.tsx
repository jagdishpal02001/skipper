import { Toggle } from '@/components';
import { useActiveVideo, useCacheInfo, useSettings } from '@/hooks';
import { VideoStatus } from './VideoStatus';
import { SettingsPanel } from './SettingsPanel';
import { SystemPanel } from './SystemPanel';

/**
 * Root popup view. Composes the status, settings and cache sections and owns
 * the master enable switch. All data flows through the hooks, which talk to the
 * background worker / content script.
 */
export function Popup() {
  const { settings, loading, update } = useSettings();
  const video = useActiveVideo();
  const cache = useCacheInfo();

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
        <Toggle
          label=""
          checked={settings.enabled}
          disabled={loading}
          onChange={(enabled) => void update({ enabled })}
        />
      </header>

      <VideoStatus video={video} enabled={settings.enabled} />
      <SettingsPanel settings={settings} onUpdate={(p) => void update(p)} />
      <SystemPanel cache={cache} />

      <div className="px-2.5 py-2 rounded-lg bg-surface-800 border border-white/5 text-[10px] text-gray-400 leading-relaxed">
        <p className="font-semibold text-gray-300 mb-0.5 flex items-center gap-1">
          <span>💡</span> AI Advisory
        </p>
        Skipper is free and AI-based; timestamps may occasionally be inaccurate. Note: You must be logged into YouTube with a Google account, as Skipper drives YouTube's built-in Gemini feature to resolve segments.
      </div>

      <footer className="pt-1 text-center text-[10px] text-gray-600">
        Skipper AI · analyzes videos on demand with Gemini
      </footer>
    </div>
  );
}
