import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ContentResponse,
} from '@/types';
import { createLogger } from './logger';

const log = createLogger('messaging');

/**
 * Type-safe wrapper around chrome.runtime.sendMessage for talking to the
 * background service worker.
 */
export async function sendToBackground<T extends BackgroundRequest>(
  request: T,
): Promise<BackgroundResponse<T['type']>> {
  try {
    return (await chrome.runtime.sendMessage(request)) as BackgroundResponse<
      T['type']
    >;
  } catch (error) {
    log.error('sendToBackground failed', request.type, error);
    throw error;
  }
}

/**
 * Type-safe wrapper around chrome.tabs.sendMessage for talking to a tab's
 * content script (used by the popup).
 */
export async function sendToTab<T extends ContentRequest>(
  tabId: number,
  request: T,
): Promise<ContentResponse<T['type']>> {
  return (await chrome.tabs.sendMessage(tabId, request)) as ContentResponse<
    T['type']
  >;
}

/** Resolve the currently active tab in the focused window, if any. */
export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}
