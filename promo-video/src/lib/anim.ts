import { useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * All motion in the video is written in seconds, not frames, so the edit can be
 * re-rendered at 30 or 60 fps without retiming anything.
 */
export const useTime = (): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, p: number): number => a + (b - a) * p;

export type Ease = (x: number) => number;

export const ease = {
  linear: ((x) => x) as Ease,
  outCubic: ((x) => 1 - Math.pow(1 - x, 3)) as Ease,
  inCubic: ((x) => x * x * x) as Ease,
  inOutCubic: ((x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)) as Ease,
  outQuart: ((x) => 1 - Math.pow(1 - x, 4)) as Ease,
  inQuart: ((x) => x * x * x * x) as Ease,
  inOutQuart: ((x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2)) as Ease,
  outExpo: ((x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))) as Ease,
  inExpo: ((x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10))) as Ease,
  inOutExpo: ((x) =>
    x <= 0
      ? 0
      : x >= 1
        ? 1
        : x < 0.5
          ? Math.pow(2, 20 * x - 10) / 2
          : (2 - Math.pow(2, -20 * x + 10)) / 2) as Ease,
  outBack: ((x) => {
    const s = 1.70158;
    return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
  }) as Ease,
  inBack: ((x) => {
    const s = 1.70158;
    return (s + 1) * x * x * x - s * x * x;
  }) as Ease,
  inOutSine: ((x) => -(Math.cos(Math.PI * x) - 1) / 2) as Ease,
};

/** 0 → 1 across [start, start + duration], eased. */
export const prog = (t: number, start: number, duration: number, e: Ease = ease.outExpo): number =>
  e(clamp((t - start) / duration));

/** Fade/slide in at `start`, out at `end`, as a single 0 → 1 → 0 envelope. */
export const inOut = (
  t: number,
  start: number,
  end: number,
  inDur = 0.5,
  outDur = 0.4,
  eIn: Ease = ease.outExpo,
  eOut: Ease = ease.inCubic,
): number => Math.min(prog(t, start, inDur, eIn), 1 - prog(t, end - outDur, outDur, eOut));

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

/**
 * Closed-form damped spring (0 → 1), continuous in time so sub-frame starts
 * behave. Returns 0 before `start`.
 */
export const spring = (
  t: number,
  start: number,
  { stiffness = 170, damping = 18, mass = 1 }: SpringConfig = {},
): number => {
  const x = t - start;
  if (x <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 - Math.exp(-zeta * w0 * x) * (Math.cos(wd * x) + ((zeta * w0) / wd) * Math.sin(wd * x))
    );
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * x) * (1 + w0 * x);
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - root);
  const r2 = -w0 * (zeta + root);
  const a = -r2 / (r2 - r1);
  const b = r1 / (r2 - r1);
  return 1 + a * Math.exp(r1 * x) + b * Math.exp(r2 * x);
};

export const SPRING = {
  pop: { stiffness: 260, damping: 16 },
  bouncy: { stiffness: 300, damping: 13 },
  snappy: { stiffness: 420, damping: 32 },
  soft: { stiffness: 120, damping: 19 },
  gentle: { stiffness: 80, damping: 17 },
} satisfies Record<string, SpringConfig>;

/**
 * Piecewise interpolation through [time, value] stops, eased per segment.
 * Holds the first/last value outside the range.
 */
export const keys = (t: number, stops: Array<[number, number]>, e: Ease = ease.inOutCubic): number => {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (t >= a[0] && t <= b[0]) {
      return mix(a[1], b[1], e((t - a[0]) / (b[0] - a[0] || 1)));
    }
  }
  return last[1];
};

/** Cheap smooth pseudo-noise in [-1, 1] — sum of incommensurate sines. */
export const wobble = (t: number, seed = 0): number =>
  (Math.sin(t * 1.13 + seed * 12.9898) * 0.5 +
    Math.sin(t * 0.71 + seed * 78.233) * 0.3 +
    Math.sin(t * 2.37 + seed * 37.719) * 0.2);

const rgbOf = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Hex (#rrggbb) → rgba() with alpha. */
export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Blend two hex colours; returns rgba() with the given alpha. */
export const blend = (from: string, to: string, p: number, a = 1): string => {
  const x = rgbOf(from);
  const y = rgbOf(to);
  const c = x.map((v, i) => Math.round(mix(v, y[i]!, clamp(p))));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
};

/** m:ss, matching the extension's formatTimestamp. */
export const timestamp = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "1h 5m" / "4m 12s" / "45s" — same rules as the extension's formatDuration. */
export const duration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
};
