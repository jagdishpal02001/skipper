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

/**
 * A transient, user-facing message surfaced as an in-page toast — used to
 * explain non-fatal failures (e.g. analysis couldn't run) without forcing the
 * user to open the popup.
 */
export interface ContentNotice {
  kind: 'error' | 'info';
  text: string;
}

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
  private noticeListeners = new Set<(notice: ContentNotice) => void>();
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

  /** Subscribe to transient notices (e.g. analysis failures) for in-page toasts. */
  onNotice(listener: (notice: ContentNotice) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  private emitNotice(notice: ContentNotice): void {
    for (const l of this.noticeListeners) l(notice);
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

  undoSkip(start: number): void {
    log.info('undoSkip requested, seeking to', start);
    this.deps.player.currentTime = start;
  }

  // ---- core flow --------------------------------------------------------

  private async onVideo(videoId: string | null): Promise<void> {
    this.analyzeAbort?.abort();
    this.deps.engine.load([]);
    this.deps.timeline.clear();
    this.setState({ ...INITIAL_STATE });

    if (!videoId) return;

    try {
      // The watch-page data isn't always ready the instant the video changes;
      // retry a few times (bailing if the user navigates away) so a transient
      // miss self-heals instead of leaving the video "undetected".
      let loaded = await this.deps.data.load(videoId);
      for (let attempt = 0; !loaded && attempt < 3; attempt++) {
        await this.delay(400 * (attempt + 1));
        if (this.deps.detector.videoId !== videoId) return; // navigated away
        loaded = await this.deps.data.load(videoId);
      }

      const metadata = this.deps.data.getMetadata(videoId);
      // Fall back to the live <video> element's duration if metadata lacks it,
      // so the timeline and skip engine still work even on a partial read.
      if (!metadata.durationSeconds && this.deps.player.duration > 0) {
        metadata.durationSeconds = this.deps.player.duration;
      }
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
            await this.commit(metadata, dbSegments, 'supabase');
            return;
          }
          log.debug('Supabase miss', metadata.videoId);
        } catch (error) {
          log.warn('Supabase lookup failed, continuing', error);
        }
      }

      // ---- Step 2: Live resolution — Ask Gemini ⇆ SponsorBlock ----
      // Priority depends on whether YouTube's "Ask about this video" AI feature
      // is usable for this visitor/video:
      //   • Signed in with the feature available → Gemini first (most accurate,
      //     per-video) and store the result in our shared DB. Fall back to the
      //     public SponsorBlock DB only if Gemini actually fails for this video.
      //   • Signed out / no AI button → go straight to the SponsorBlock DB.
      const ctx: ProviderContext = {
        metadata,
        transcript: null,
        settings,
        signal: abort.signal,
      };

      if (await this.deps.askProvider.isAvailable(ctx)) {
        try {
          const segments = await this.runAskGemini(ctx, duration);
          await this.commit(metadata, segments, 'ask-gemini');
          return;
        } catch (error) {
          if (abort.signal.aborted) return;
          log.warn('Ask Gemini failed — falling back to SponsorBlock', error);
          const fallback = await this.lookupSponsorBlock(metadata);
          if (fallback) {
            await this.commit(metadata, fallback, 'sponsorblock');
            return;
          }
          throw error; // nothing left to try → outer catch surfaces the toast
        }
      }

      // Signed out / no AI feature available: rely on the public community DB.
      const community = await this.lookupSponsorBlock(metadata);
      if (community) {
        await this.commit(metadata, community, 'sponsorblock');
        return;
      }
      throw new Error(
        'Ask Gemini not available and no community data for this video',
      );
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
      this.emitNotice({ kind: 'error', text: this.noticeFor(error) });
    }
  }

  /**
   * Run YouTube's "Ask about this video" Gemini analysis and persist the result
   * to our shared DB (fire-and-forget) so future visitors hit the cache first.
   * Throws if Gemini is unavailable or fails for this video.
   */
  private async runAskGemini(
    ctx: ProviderContext,
    duration: number,
  ): Promise<SponsorSegment[]> {
    log.info('analyzing via Ask Gemini cascade (API → DOM)');
    const segments = await this.deps.askProvider.getSegments(ctx);

    // Store to Supabase in the background — never block the user flow on it.
    sendToBackground({
      type: 'SUPABASE_STORE',
      videoId: ctx.metadata.videoId,
      duration,
      segments,
      provider: 'ask-gemini',
    }).catch(() => { /* silent */ });

    return segments;
  }

  /**
   * Look up the public SponsorBlock community DB via the background worker.
   * Returns the segments on a hit, or null on a miss/error so callers cascade.
   */
  private async lookupSponsorBlock(
    metadata: VideoMetadata,
  ): Promise<SponsorSegment[] | null> {
    try {
      const { segments } = await sendToBackground({
        type: 'SPONSORBLOCK_LOOKUP',
        videoId: metadata.videoId,
      });
      if (segments && segments.length > 0) {
        log.info('SponsorBlock hit', metadata.videoId);
        return segments;
      }
      log.debug('SponsorBlock miss', metadata.videoId);
      return null;
    } catch (error) {
      log.warn('SponsorBlock lookup failed', error);
      return null;
    }
  }

  /**
   * Maps an analysis error to a short, user-facing toast message. When the Ask
   * Gemini panel/API is unavailable (not signed in, or YouTube doesn't expose
   * the AI feature here) and the community DB also had nothing, nudge the user
   * to sign in. Otherwise show a generic "something went wrong" message.
   */
  private noticeFor(error: unknown): string {
    const msg = this.message(error);
    if (/no ask gemini backend|not available|unavailable|not logged in/i.test(msg)) {
      return "Sign in to YouTube — Skipper couldn't find sponsors for this video.";
    }
    return 'Something went wrong — Skipper couldn’t analyze this video.';
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

    // A fresh, successful analysis that found nothing: let the user know the
    // video is clean rather than leaving them wondering whether it ran.
    if (segments.length === 0) {
      this.emitNotice({
        kind: 'info',
        text: 'No sponsors found in this video.',
      });
    }
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private patch(partial: Partial<VideoRuntimeState>): void {
    this.setState({ ...this.state, ...partial });
  }

  private setState(next: VideoRuntimeState): void {
    this.state = next;
    for (const l of this.listeners) l(next);
  }
}
