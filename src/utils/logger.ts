/**
 * Tiny namespaced logger. Keeps console output greppable and lets us silence
 * everything in one place for production builds.
 */
const PREFIX = '%c[Skipper]';
const STYLE = 'color:#2b82f6;font-weight:600';

const enabled = true;

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  const tag = `${PREFIX} ${scope}`;
  return {
    debug: (...args) => enabled && console.debug(tag, STYLE, ...args),
    info: (...args) => enabled && console.info(tag, STYLE, ...args),
    warn: (...args) => console.warn(tag, STYLE, ...args),
    error: (...args) => console.error(tag, STYLE, ...args),
  };
}
