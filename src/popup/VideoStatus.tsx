import { useState } from 'react';
import type { VideoRuntimeState } from '@/types';
import { Button, Card, SegmentList, StatBadge } from '@/components';
import { formatDuration } from '@/utils/time';
import type { useActiveVideo } from '@/hooks';

type ActiveVideo = ReturnType<typeof useActiveVideo>;

const STATUS_TEXT: Record<VideoRuntimeState['status'], string> = {
  idle: 'Waiting for video',
  analyzing: 'Analyzing…',
  ready: 'Ready',
  error: 'Error',
};

/**
 * The "current video" section of the popup: shows what's playing, the live
 * sponsor count / time saved, and the analyse controls.
 */
export function VideoStatus({
  video,
  enabled,
}: {
  video: ActiveVideo;
  enabled: boolean;
}) {
  const [showSegments, setShowSegments] = useState(false);
  const { state, isYouTube, loading, reanalyze } = video;

  if (loading) {
    return <Card title="Current Video"><p className="text-sm text-gray-400">Loading…</p></Card>;
  }

  if (!isYouTube) {
    return (
      <Card title="Current Video">
        <p className="text-sm text-gray-400">
          Open a YouTube video to analyze it for sponsor segments.
        </p>
      </Card>
    );
  }

  if (!state || !state.metadata) {
    return (
      <Card title="Current Video">
        <p className="text-sm text-gray-400">
          No video detected yet. Try reloading the YouTube tab.
        </p>
      </Card>
    );
  }

  const segments = state.result?.segments ?? [];
  const analyzing = state.status === 'analyzing';
  const canAnalyze = enabled && !analyzing && !state.metadata.isLive;

  return (
    <Card
      title="Current Video"
      action={
        <span className="text-xs text-gray-400 font-semibold">
          {!enabled ? 'Disabled' : STATUS_TEXT[state.status]}
          {enabled && state.fromCache && state.status === 'ready' ? ' · cached' : ''}
        </span>
      }
    >
      <div className="mb-3">
        <p className="line-clamp-2 text-sm font-semibold text-white leading-snug">
          {state.metadata.title}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">{state.metadata.channel}</p>
      </div>

      {!enabled && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10.5px] font-medium text-amber-500 leading-normal">
          Skipper is currently disabled. Toggle the power switch in the header to activate sponsor skipping.
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <StatBadge value={String(segments.length)} label="Sponsors" />
        <StatBadge value={formatDuration(state.timeSavedSeconds)} label="Saved" />
        <StatBadge value={String(state.skippedCount)} label="Skips" />
      </div>

      {state.status === 'error' && state.error && enabled && (
        <p className="mb-2 text-xs text-red-400">{state.error}</p>
      )}
      {state.metadata.isLive && enabled && (
        <p className="mb-2 text-xs text-gray-400">
          Livestream detected — automatic skipping is disabled.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          block
          disabled={!canAnalyze}
          onClick={() => void reanalyze()}
        >
          {analyzing ? 'Analyzing…' : segments.length ? 'Reanalyze' : 'Analyze'}
        </Button>
        <Button onClick={() => setShowSegments((v) => !v)} disabled={!enabled}>
          {showSegments ? 'Hide' : 'Segments'}
        </Button>
      </div>

      {showSegments && enabled && (
        <div className="mt-3">
          <SegmentList segments={segments} />
        </div>
      )}
    </Card>
  );
}
