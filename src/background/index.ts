import type {
  BackgroundRequest,
  BackgroundResponseMap,
} from '@/types';
import { createLogger } from '@/utils/logger';
import { segmentCache, settingsRepository, errorLogRepository } from '@/storage';
import { supabaseLookup, supabaseStore, supabaseLogEvent } from '@/services/supabase';

const log = createLogger('background');

/**
 * Service worker message hub. Owns all privileged work: cache reads/writes,
 * settings management, error logging, and Supabase segment DB.
 * Content scripts and the popup talk to it exclusively through typed messages.
 */
chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      log.error('handler error', message.type, error);
      sendResponse({ ok: false, error: errorMessage(error) });
    });
  // Returning true keeps the message channel open for the async response.
  return true;
});

async function handle(
  message: BackgroundRequest,
): Promise<BackgroundResponseMap[BackgroundRequest['type']]> {
  switch (message.type) {
    case 'SAVE_RESULT': {
      await segmentCache.set(message.result);
      return { ok: true };
    }

    case 'GET_CACHED': {
      const result = await segmentCache.get(message.videoId);
      return { ok: true, result };
    }

    case 'CLEAR_CACHE': {
      if (message.videoId) await segmentCache.remove(message.videoId);
      else await segmentCache.clear();
      return { ok: true };
    }

    case 'GET_SETTINGS': {
      const settings = await settingsRepository.get();
      return { ok: true, settings };
    }

    case 'UPDATE_SETTINGS': {
      const settings = await settingsRepository.update(message.patch);
      return { ok: true, settings };
    }

    case 'GET_CACHE_INFO': {
      const info = await segmentCache.info();
      return { ok: true, info };
    }

    case 'ADD_ERROR_LOG': {
      await errorLogRepository.addLog({
        videoId: message.videoId,
        videoTitle: message.videoTitle,
        errorMessage: message.errorMessage,
        analysisMode: message.analysisMode,
      });
      return { ok: true };
    }

    case 'GET_ERROR_LOGS': {
      const logs = await errorLogRepository.getLogs();
      return { ok: true, logs };
    }

    case 'CLEAR_ERROR_LOGS': {
      await errorLogRepository.clear();
      return { ok: true };
    }

    case 'SUPABASE_LOOKUP': {
      const segments = await supabaseLookup(message.videoId, message.duration);
      return { ok: true, segments };
    }

    case 'SUPABASE_STORE': {
      await supabaseStore(
        message.videoId,
        message.duration,
        message.segments,
        message.provider,
      );
      return { ok: true };
    }

    case 'SUPABASE_LOG_EVENT': {
      await supabaseLogEvent(
        message.eventType,
        message.videoId,
        message.extraData,
      );
      return { ok: true };
    }

    default: {
      const _never: never = message;
      throw new Error(`Unknown message: ${JSON.stringify(_never)}`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Housekeeping: prune expired cache entries on startup/install.
chrome.runtime.onInstalled.addListener(() => {
  void segmentCache.pruneExpired().then((n) => n && log.info(`pruned ${n} expired`));
});
chrome.runtime.onStartup.addListener(() => {
  void segmentCache.pruneExpired();
});

log.info('service worker ready');
