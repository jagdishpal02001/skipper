import { useEffect, useState } from 'react';
import { Card } from '@/components';
import type { useCacheInfo } from '@/hooks';
import { sendToBackground } from '@/utils/messaging';
import type { ErrorLogEntry } from '@/types';

type CacheState = ReturnType<typeof useCacheInfo>;

export function SystemPanel({ cache }: { cache: CacheState }) {
  const { info, clearAll } = cache;
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const loadLogs = async () => {
    const res = await sendToBackground({ type: 'GET_ERROR_LOGS' });
    if (res.ok) setLogs(res.logs);
  };

  useEffect(() => {
    if (showLogs) void loadLogs();
  }, [showLogs]);

  const handleClearLogs = async () => {
    await sendToBackground({ type: 'CLEAR_ERROR_LOGS' });
    setLogs([]);
  };

  return (
    <Card title="System">
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 font-medium">Cache</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-300 font-medium">
              {info ? `${info.entries} video${info.entries === 1 ? '' : 's'}` : '—'}
            </span>
            <button
              onClick={() => void clearAll()}
              disabled={!info?.entries}
              className="text-[10px] text-red-400 hover:underline disabled:opacity-50 font-semibold cursor-pointer"
            >
              Clear cache
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-2">
          <span className="text-gray-400 font-medium">Error Logs</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogs((v) => !v)}
              className="text-brand-400 hover:underline font-semibold cursor-pointer"
            >
              {showLogs ? 'Hide logs' : 'View logs'}
            </button>
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="text-[10px] text-red-400 hover:underline font-semibold cursor-pointer"
              >
                Clear logs
              </button>
            )}
          </div>
        </div>

        {showLogs && (
          <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-white/5 bg-surface-900 p-2 font-mono text-[10px] text-gray-400 flex flex-col gap-1.5">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-2">No errors logged.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex justify-between text-gray-500 mb-0.5">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>mode: {log.analysisMode ?? 'n/a'}</span>
                  </div>
                  {log.videoTitle && (
                    <div className="text-gray-300 font-medium truncate mb-0.5" title={log.videoTitle}>
                      {log.videoTitle}
                    </div>
                  )}
                  <div className="text-red-400/90 break-all leading-tight">{log.errorMessage}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
