import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from '../theme';
import { alpha, blend, clamp, useTime } from '../lib/anim';
import { SECTIONS, WIDTH, HEIGHT } from '../timing';
import type { SectionId } from '../timing';

/** Accent glow per section — the room's light shifts with the story. */
const ACCENT: Record<SectionId, string> = {
  intro: C.brand500,
  skip: C.sponsor,
  cascade: C.geminiPurple,
  ratings: C.ratingGood,
  dashboard: C.brand500,
  benefits: C.geminiPurple,
  cta: C.brand500,
};

const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

const ORBS = [
  { color: C.brand500, x: 0.16, y: 0.18, r: 640, ax: 110, ay: 70, speed: 0.21, phase: 0, a: 0.3 },
  { color: C.geminiPurple, x: 0.86, y: 0.3, r: 700, ax: 90, ay: 80, speed: 0.17, phase: 1.3, a: 0.26 },
  { color: C.brand600, x: 0.06, y: 0.92, r: 560, ax: 80, ay: 50, speed: 0.19, phase: 2.1, a: 0.24 },
  { color: C.geminiCyan, x: 0.8, y: 0.95, r: 600, ax: 110, ay: 60, speed: 0.15, phase: 3.7, a: 0.16 },
];

/** Accent colour at time t, cross-fading across the second around each cut. */
const accentAt = (t: number): string => {
  let i = SECTIONS.findIndex((s) => t < s.start + s.duration);
  if (i === -1) i = SECTIONS.length - 1;
  const cur = SECTIONS[i]!;
  const prev = SECTIONS[i - 1];
  const next = SECTIONS[i + 1];
  const end = cur.start + cur.duration;
  if (prev && t < cur.start + 0.6) {
    return blend(ACCENT[prev.id], ACCENT[cur.id], 0.5 + clamp((t - cur.start) / 1.2), 0.14);
  }
  if (next && t > end - 0.6) {
    return blend(ACCENT[cur.id], ACCENT[next.id], clamp((t - (end - 0.6)) / 1.2), 0.14);
  }
  return alpha(ACCENT[cur.id], 0.14);
};

export const Background: React.FC = () => {
  const t = useTime();

  return (
    <AbsoluteFill style={{ background: C.bgDeep, overflow: 'hidden' }}>
      {ORBS.map((o, i) => {
        const cx = o.x * WIDTH + Math.sin(t * o.speed * 2.2 + o.phase) * o.ax;
        const cy = o.y * HEIGHT + Math.cos(t * o.speed * 1.9 + o.phase) * o.ay;
        const scale = 1 + Math.sin(t * 0.4 + o.phase) * 0.08;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx - o.r,
              top: cy - o.r,
              width: o.r * 2,
              height: o.r * 2,
              borderRadius: '50%',
              transform: `scale(${scale})`,
              background: `radial-gradient(circle, ${alpha(o.color, o.a)} 0%, ${alpha(
                o.color,
                o.a * 0.35,
              )} 38%, transparent 68%)`,
            }}
          />
        );
      })}

      {/* Section accent: a broad low glow behind whatever is centre stage. */}
      <div
        style={{
          position: 'absolute',
          left: WIDTH / 2 - 900,
          top: HEIGHT / 2 - 520,
          width: 1800,
          height: 1100,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${accentAt(t)} 0%, transparent 62%)`,
        }}
      />

      {/* The website's grid, drifting slowly. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          backgroundPosition: `0px ${(t * 6) % 64}px`,
          maskImage: 'radial-gradient(ellipse at 50% 45%, black 35%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, black 35%, transparent 80%)',
        }}
      />

      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      {/* Static grain: kills gradient banding without costing bitrate. */}
      <AbsoluteFill style={{ backgroundImage: NOISE, opacity: 0.07, mixBlendMode: 'overlay' }} />
    </AbsoluteFill>
  );
};
