import type { Settings, SponsorSegment, Transcript, VideoMetadata } from '@/types';

/**
 * Everything a provider needs to produce segments for a video. Providers pick
 * the bits they care about — a community lookup only needs the videoId, while
 * Gemini wants the transcript and metadata.
 */
export interface ProviderContext {
  metadata: VideoMetadata;
  transcript: Transcript | null;
  settings: Settings;
  /** Allows the orchestrator to cancel long-running analysis. */
  signal?: AbortSignal;
}

/**
 * Core abstraction behind the plugin architecture. A SegmentProvider knows how
 * to turn a video (plus optional transcript) into a list of sponsor segments.
 *
 * New strategies — community databases, the future "Ask Gemini" panel, a local
 * model — implement this interface and are registered with the
 * {@link ProviderRegistry}. Nothing else in the codebase needs to change.
 */
export interface SegmentProvider {
  /** Stable identifier persisted alongside cached results. */
  readonly id: string;
  /** Human-readable name shown in the UI. */
  readonly label: string;
  /**
   * Whether this provider can run for the given context right now (e.g. Gemini
   * needs an API key and a transcript). Cheap, synchronous-friendly check.
   */
  isAvailable(ctx: ProviderContext): boolean | Promise<boolean>;
  /** Produce segments. May throw; the orchestrator handles fallbacks. */
  getSegments(ctx: ProviderContext): Promise<SponsorSegment[]>;
}

/**
 * Abstraction over a way to ask YouTube's "Ask about this video" Gemini.
 * Implemented in the content script — either by calling the InnerTube
 * `get_panel` endpoint directly (preferred, no UI disruption) or by driving the
 * DOM panel (fallback). Kept as an interface here so {@link SegmentProvider}s
 * stay free of DOM/network specifics and remain testable.
 */
export interface AskGeminiDriver {
  /** Identifier for logging (e.g. 'api', 'dom'). */
  readonly id: string;
  /** Whether this backend can run on the current page right now. */
  isAvailable(): boolean;
  /** Submit a prompt and resolve with the assistant's reply text. */
  ask(prompt: string, videoId: string, signal?: AbortSignal): Promise<string>;
}
