import React from 'react';
import { AI_GRADIENT, C, FONT } from '../theme';
import { clamp, ease, mix, prog, useTime } from '../lib/anim';
import type { Ease } from '../lib/anim';

export const gradientText = (gradient = AI_GRADIENT): React.CSSProperties => ({
  backgroundImage: gradient,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

interface RevealTextProps {
  /** Words wrapped in *asterisks* render with the AI gradient. */
  text: string;
  /** Scene-local start time (s). */
  start: number;
  stagger?: number;
  duration?: number;
  /** Optional exit: words drop away from this time. */
  exit?: number;
  style?: React.CSSProperties;
  align?: 'left' | 'center' | 'right';
  easing?: Ease;
  gradient?: string;
}

/**
 * Word-by-word mask reveal: each word rises out of its own clipped line with a
 * touch of blur, the standard premium-title move.
 */
export const RevealText: React.FC<RevealTextProps> = ({
  text,
  start,
  stagger = 0.06,
  duration = 0.7,
  exit,
  style,
  align = 'left',
  easing = ease.outExpo,
  gradient = AI_GRADIENT,
}) => {
  const t = useTime();
  const lines = text.split('\n');
  let index = 0;

  return (
    <div style={{ textAlign: align, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'block' }}>
          {line.split(' ').map((raw, wi) => {
            const i = index++;
            const highlighted = raw.startsWith('*') && raw.replace(/[.,!?]$/, '').endsWith('*');
            const word = raw.replace(/\*/g, '');
            const p = prog(t, start + i * stagger, duration, easing);
            const out = exit === undefined ? 0 : prog(t, exit + i * 0.025, 0.35, ease.inCubic);
            const y = mix(105, 0, p) + out * -105;
            const blur = (1 - p) * 8 + out * 6;
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  overflow: 'hidden',
                  verticalAlign: 'top',
                  // Room for descenders and the gradient's overshoot.
                  padding: '0.06em 0.02em 0.14em',
                  margin: '-0.06em -0.02em -0.14em',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    transform: `translateY(${y}%)`,
                    filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
                    opacity: clamp(p * 1.6) * (1 - out),
                    ...(highlighted ? gradientText(gradient) : null),
                  }}
                >
                  {word}
                </span>
                {wi < line.split(' ').length - 1 ? ' ' : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Small uppercase section label: "01 · AUTO-SKIP". */
export const Kicker: React.FC<{
  index: string;
  label: string;
  start: number;
  color?: string;
  exit?: number;
  style?: React.CSSProperties;
}> = ({ index, label, start, color = C.brand400, exit, style }) => {
  const t = useTime();
  const p = prog(t, start, 0.6);
  const out = exit === undefined ? 0 : prog(t, exit, 0.3, ease.inCubic);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 20px 10px 12px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}40`,
        boxShadow: `0 0 30px ${color}22`,
        fontFamily: FONT.body,
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color,
        opacity: p * (1 - out),
        transform: `translateY(${(1 - p) * 20 - out * 10}px)`,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round 999px)`,
        ...style,
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          minWidth: 40,
          height: 32,
          padding: '0 8px',
          borderRadius: 999,
          background: `${color}22`,
          letterSpacing: '0.04em',
          fontWeight: 700,
        }}
      >
        {index}
      </span>
      {label}
    </div>
  );
};
