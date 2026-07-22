import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  SponsorSkipEngine,
  TranscriptService,
  VideoDetector,
  YouTubeData,
  YouTubePlayer,
} from '@/services';
import { AskGeminiProvider } from '@/providers';
import type { ContentRequest } from '@/types';
import { createLogger } from '@/utils/logger';
import { ContentController } from './ContentController';
import { AskGeminiApi } from './services/AskGeminiApi';
import { AskGeminiPanel } from './services/AskGeminiPanel';
import { TimelineMarkers } from './services/TimelineMarkers';
import { UsageTracker } from './services/UsageTracker';
import { CommentsApi } from './services/CommentsApi';
import { SentimentService } from './services/SentimentService';
import { SentimentBadge } from './services/SentimentBadge';
import { ToastStack } from './widget/Toast';
import widgetCss from './widget/widget.css?inline';

const log = createLogger('content:boot');

/**
 * Entry point for the content script. Initializes and wires all core services,
 * boots the controller, and mounts the skip notifications overlay.
 */
function bootstrap(): void {
  const player = new YouTubePlayer();
  const data = new YouTubeData();
  // Prefer the InnerTube API (no UI disruption); fall back to driving the DOM.
  // Shared by both sponsor-segment analysis and sentiment analysis.
  const askDrivers = [new AskGeminiApi(), new AskGeminiPanel()];
  const controller = new ContentController({
    detector: new VideoDetector(),
    data,
    transcripts: new TranscriptService(data),
    player,
    engine: new SponsorSkipEngine(player),
    askProvider: new AskGeminiProvider(askDrivers),
    timeline: new TimelineMarkers(),
    usage: new UsageTracker(player),
    sentiment: new SentimentService(askDrivers, new CommentsApi()),
    badge: new SentimentBadge(),
  });

  void controller.init();
  mountToasts(controller);
  registerMessaging(controller);

  window.addEventListener('beforeunload', () => controller.dispose());
  log.info('content script initialised');
}

/**
 * Mounts the toast overlay — the only in-page UI. No persistent widget/card;
 * all controls live in the popup. Rendered into an isolated Shadow DOM so
 * YouTube's styles can't leak in or out.
 */
function mountToasts(controller: ContentController): void {
  const host = document.createElement('div');
  host.id = 'skipper-toast-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = widgetCss;
  shadow.appendChild(style);

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  document.documentElement.appendChild(host);

  createRoot(mountPoint).render(
    <StrictMode>
      <ToastStack controller={controller} />
    </StrictMode>,
  );
}

function registerMessaging(controller: ContentController): void {
  chrome.runtime.onMessage.addListener(
    (message: ContentRequest, _sender, sendResponse) => {
      controller
        .handleMessage(message)
        .then(sendResponse)
        .catch((error: unknown) => {
          log.error('message handler failed', error);
          sendResponse({ ok: false });
        });
      return true;
    },
  );
}

bootstrap();
