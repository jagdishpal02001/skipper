import type { Settings, SkippableCategory } from '@/types';
import { Card } from '@/components';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

const SKIP_OPTIONS: { key: SkippableCategory; label: string }[] = [
  { key: 'sponsor', label: 'Sponsors' },
  { key: 'self_promo', label: 'Self-Promo' },
  { key: 'intro', label: 'Intros' },
  { key: 'outro', label: 'Outros' },
];

export function SettingsPanel({ settings, onUpdate }: SettingsPanelProps) {
  return (
    <Card title="Settings">
      <div className="flex flex-col gap-3">
        {/* Skip Categories as sleek pills */}
        <div>
          <label className="mb-1.5 block text-[10px] uppercase font-bold tracking-wider text-gray-400">
            Skip Categories
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SKIP_OPTIONS.map((opt) => {
              const active = settings.skip[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    onUpdate({
                      skip: { ...settings.skip, [opt.key]: !active },
                    })
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-brand-500/20 border-brand-500 text-brand-400 hover:bg-brand-500/30'
                      : 'bg-surface-700/40 border-white/5 text-gray-400 hover:border-white/15 hover:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Behavior Toggles */}
        <div className="flex gap-4 border-t border-white/5 pt-2 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={settings.autoAnalyze}
              onChange={(e) => onUpdate({ autoAnalyze: e.target.checked })}
              className="rounded border-white/10 bg-surface-700 text-brand-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Auto-analyze</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={settings.showNotifications}
              onChange={(e) => onUpdate({ showNotifications: e.target.checked })}
              className="rounded border-white/10 bg-surface-700 text-brand-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Show alerts</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={settings.showRatingBadge}
              onChange={(e) => onUpdate({ showRatingBadge: e.target.checked })}
              className="rounded border-white/10 bg-surface-700 text-brand-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Rating badge</span>
          </label>
        </div>
      </div>
    </Card>
  );
}
