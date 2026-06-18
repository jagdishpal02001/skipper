import type {
  AnalysisResult,
  ContentRequest,
  ContentResponseMap,
  Settings,
  SponsorSegment,
  VideoMetadata,
  VideoRuntimeState,
} from '@/types';
import type {
  SponsorSkipEngine,
  TranscriptService,
  VideoDetector,
  YouTubeData,
  YouTubePlayer,
} from '@/services';
import type { SkipEvent } from '@/services';
import type { ProviderContext, SegmentProvider } from '@/providers';
import { sendToBackground } from '@/utils/messaging';
import { createLogger } from '@/utils/logger';
import type { TimelineMarkers } from './services/TimelineMarkers';

const log = createLogger('content');

export interface ContentControllerDeps {
  detector: VideoDetector;
  data: YouTubeData;
  transcripts: TranscriptService;
  player: YouTubePlayer;
  engine: SponsorSkipEngine;
  /** Drives YouTube's in-page "Ask about this video" Gemini panel. */
  askProvider: SegmentProvider;
  /** Paints detected segments onto the player progress bar. */
  timeline: TimelineMarkers;
}

const INITIAL_STATE: VideoRuntimeState = {
  metadata: null,
  status: 'idle',
  result: null,
  skippedCount: 0,
  timeSavedSeconds: 0,
  fromCache: false,
};

/**
 * Core controller for the content script. Reacts to video changes, orchestrates
 * transcript retrieval and Gemini analysis, controls the playback skip engine,
 * and maintains the runtime state observed by the popup and in-player toasts.
 */
export class ContentController {
  private state: VideoRuntimeState = { ...INITIAL_STATE };
  private listeners = new Set<(state: VideoRuntimeState) => void>();
  private skipEventListeners = new Set<(event: SkipEvent) => void>();
  private settings: Settings | null = null;
  private analyzeAbort: AbortController | null = null;
  private disposers: (() => void)[] = [];

  constructor(private readonly deps: ContentControllerDeps) {}

  async init(): Promise<void> {
    const { settings } = await sendToBackground({ type: 'GET_SETTINGS' });
    this.settings = settings;
    this.deps.engine.setSettings(settings);
    this.deps.engine.setEnabled(settings.enabled);

    this.disposers.push(
      this.deps.engine.onStats((stats) =>
        this.patch({
          skippedCount: stats.skippedCount,
          timeSavedSeconds: stats.timeSavedSeconds,
        }),
      ),
    );
    this.disposers.push(
      this.deps.engine.onSkip((event) => {
        for (const l of this.skipEventListeners) l(event);
        const videoId = this.state.metadata?.videoId;
        if (videoId) {
          sendToBackground({
            type: 'SUPABASE_LOG_EVENT',
            eventType: 'skip',
            videoId,
            extraData: {
              category: event.segment.type,
              duration_seconds: Math.round(event.to - event.from),
              confidence: event.segment.confidence,
            },
          }).catch(() => {});
        }
      }),
    );

    // React to settings changes from the popup live.
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync') void this.refreshSettings();
    });

    this.deps.engine.start();
    this.disposers.push(this.deps.detector.onChange((id) => this.onVideo(id)));
    this.deps.detector.start();
  }

  dispose(): void {
    this.deps.detector.stop();
    this.deps.engine.stop();
    this.analyzeAbort?.abort();
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  // ---- observable store -------------------------------------------------

  getState(): VideoRuntimeState {
    return this.state;
  }

  /** Whether transient skip toasts should be shown (user setting). */
  get notificationsEnabled(): boolean {
    return this.settings?.showNotifications ?? true;
  }

  subscribe(listener: (state: VideoRuntimeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSkipEvent(listener: (event: SkipEvent) => void): () => void {
    this.skipEventListeners.add(listener);
    return () => this.skipEventListeners.delete(listener);
  }

  // ---- popup message handling ------------------------------------------

  async handleMessage<T extends ContentRequest>(
    message: T,
  ): Promise<ContentResponseMap[T['type']]> {
    type R = ContentResponseMap[T['type']];
    switch (message.type) {
      case 'GET_STATE':
        return { ok: true, state: this.state } as R;
      case 'REANALYZE':
        void this.analyze(true);
        return { ok: true } as R;
      case 'SET_ENABLED':
        await sendToBackground({
          type: 'UPDATE_SETTINGS',
          patch: { enabled: message.enabled },
        });
        return { ok: true } as R;
      default: {
        const _never: never = message;
        throw new Error(`Unknown content message ${JSON.stringify(_never)}`);
      }
    }
  }

  // ---- actions invoked from the widget ---------------------------------

  reanalyze(): void {
    void this.analyze(true);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await sendToBackground({ type: 'UPDATE_SETTINGS', patch: { enabled } });
  }

  // ---- core flow --------------------------------------------------------

  private async onVideo(videoId: string | null): Promise<void> {
    this.analyzeAbort?.abort();
    this.deps.engine.load([]);
    this.deps.timeline.clear();
    this.setState({ ...INITIAL_STATE });

    if (!videoId) return;

    try {
      await this.deps.data.load(videoId);
      const metadata = this.deps.data.getMetadata(videoId);
      this.patch({ metadata });

      if (!this.settings?.enabled) {
        log.info('Skipper is disabled — bypassing automatic analysis');
        return;
      }

      if (metadata.isLive) {
        log.info('livestream — analysis disabled');
        return;
      }

      // Fast path: a cached result means we never touch the Ask Gemini panel
      const { result: cached } = await sendToBackground({
        type: 'GET_CACHED',
        videoId,
      });
      if (cached) {
        log.info('cache hit — skipping analysis', videoId);
        this.applyResult(cached, true);
        return;
      }

      if (this.settings?.autoAnalyze) {
        await this.analyze(false);
      }
    } catch (error) {
      log.error('onVideo failed', error);

      // Save failure log
      await sendToBackground({
        type: 'ADD_ERROR_LOG',
        videoId,
        errorMessage: `Initialization failed: ${this.message(error)}`,
      });

      this.patch({ status: 'error', error: this.message(error) });
    }
  }



  private async analyze(force: boolean): Promise<void> {
    const metadata = this.state.metadata;
    const settings = this.settings;
    if (!metadata || !settings) return;

    this.analyzeAbort?.abort();
    const abort = new AbortController();
    this.analyzeAbort = abort;
    this.patch({ status: 'analyzing', error: undefined });

    const duration = Math.round(metadata.durationSeconds);

    try {
      // ---- Step 0: Local cache ----
      if (!force) {
        const { result } = await sendToBackground({
          type: 'GET_CACHED',
          videoId: metadata.videoId,
        });
        if (result) {
          this.applyResult(result, true);
          return;
        }
      }

      // ---- Step 1: Supabase (shared public DB) ----
      if (!force) {
        try {
          const { segments: dbSegments } = await sendToBackground({
            type: 'SUPABASE_LOOKUP',
            videoId: metadata.videoId,
            duration,
          });
          if (dbSegments && dbSegments.length > 0) {
            log.info('Supabase hit', metadata.videoId);
            sendToBackground({
              type: 'SUPABASE_LOG_EVENT',
              eventType: 'lookup_hit',
              videoId: metadata.videoId,
            }).catch(() => {});
            await this.commit(metadata, dbSegments, 'supabase');
            return;
          }
          log.debug('Supabase miss', metadata.videoId);
          sendToBackground({
            type: 'SUPABASE_LOG_EVENT',
            eventType: 'lookup_miss',
            videoId: metadata.videoId,
          }).catch(() => {});
        } catch (error) {
          log.warn('Supabase lookup failed, continuing', error);
        }
      }

      // ---- Step 2: Ask Gemini (API → DOM fallback) ----
      const ctx: ProviderContext = {
        metadata,
        transcript: null,
        settings,
        signal: abort.signal,
      };

      log.info('analyzing via Ask Gemini cascade (API → DOM)');
      const segments = await this.deps.askProvider.getSegments(ctx);

      // Store to Supabase in the background (fire-and-forget)
      sendToBackground({
        type: 'SUPABASE_STORE',
        videoId: metadata.videoId,
        duration,
        segments,
        provider: 'ask-gemini',
      }).then(() => {
        sendToBackground({
          type: 'SUPABASE_LOG_EVENT',
          eventType: 'store',
          videoId: metadata.videoId,
          extraData: { provider: 'ask-gemini', segment_count: segments.length },
        }).catch(() => {});
      }).catch(() => { /* silent — never block the user flow */ });

      await this.commit(metadata, segments, 'ask-gemini');
    } catch (error) {
      if (abort.signal.aborted) return;
      log.error('Analysis failed', error);

      // Save failure log
      await sendToBackground({
        type: 'ADD_ERROR_LOG',
        videoId: metadata.videoId,
        videoTitle: metadata.title,
        errorMessage: this.message(error),
      });

      this.patch({
        status: 'error',
        error: 'Failed to fetch sponsored timestamps',
      });
    }
  }

  /** Build a result from content-produced segments, cache it, and apply it. */
  private async commit(
    metadata: VideoMetadata,
    segments: SponsorSegment[],
    provider: string,
  ): Promise<void> {
    const result: AnalysisResult = {
      videoId: metadata.videoId,
      title: metadata.title,
      channel: metadata.channel,
      durationSeconds: metadata.durationSeconds,
      segments,
      provider,
      createdAt: Date.now(),
    };
    await sendToBackground({ type: 'SAVE_RESULT', result });
    this.applyResult(result, false);
  }

  private applyResult(result: AnalysisResult, fromCache: boolean): void {
    this.deps.engine.load(result.segments);
    if (this.settings?.enabled) {
      this.deps.timeline.render(
        this.deps.engine.getActiveSegments(),
        result.durationSeconds,
      );
    } else {
      this.deps.timeline.clear();
    }
    this.patch({
      status: 'ready',
      result,
      fromCache,
      skippedCount: 0,
      timeSavedSeconds: 0,
    });
    log.info(
      `ready: ${result.segments.length} segments via ${result.provider}`,
    );
  }

  private async refreshSettings(): Promise<void> {
    const wasEnabled = this.settings?.enabled ?? true;
    const { settings } = await sendToBackground({ type: 'GET_SETTINGS' });
    this.settings = settings;
    this.deps.engine.setSettings(settings);
    this.deps.engine.setEnabled(settings.enabled);

    // If Skipper was enabled, and we have metadata but no result yet, run analysis
    if (!wasEnabled && settings.enabled && this.state.metadata && !this.state.result && this.state.status === 'idle') {
      void this.analyze(false);
    }

    if (!settings.enabled) {
      this.deps.timeline.clear();
    } else if (this.state.result) {
      this.deps.timeline.render(
        this.deps.engine.getActiveSegments(),
        this.state.result.durationSeconds,
      );
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private patch(partial: Partial<VideoRuntimeState>): void {
    this.setState({ ...this.state, ...partial });
  }

  private setState(next: VideoRuntimeState): void {
    this.state = next;
    for (const l of this.listeners) l(next);
  }
}
