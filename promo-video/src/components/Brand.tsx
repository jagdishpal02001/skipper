import React from 'react';
import { AI_GRADIENT, C, FONT } from '../theme';

/**
 * The fast-forward glyph from the extension icon (scripts/generate-icons.mjs):
 * two stacked play triangles, softened with round joins.
 */
export const FastForwardGlyph: React.FC<{
  size: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ size, color = '#fff', style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', ...style }}>
    <g fill={color} stroke={color} strokeWidth={5} strokeLinejoin="round">
      <path d="M21 32 L49 50 L21 68 Z" />
      <path d="M49 32 L77 50 L49 68 Z" />
    </g>
  </svg>
);

/** The extension icon: brand-blue rounded tile + white fast-forward glyph. */
export const AppIcon: React.FC<{
  size: number;
  /** 0 → 1: the tile grows in behind the glyph. */
  tile?: number;
  glow?: number;
  style?: React.CSSProperties;
}> = ({ size, tile = 1, glow = 1, style }) => (
  <div style={{ position: 'relative', width: size, height: size, ...style }}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: size * 0.24,
        transform: `scale(${tile})`,
        background: `linear-gradient(160deg, #4f9dff 0%, ${C.brand600} 48%, ${C.brand700} 100%)`,
        boxShadow: `0 ${size * 0.12}px ${size * 0.5}px rgba(43,130,246,${0.55 * glow}), inset 0 ${
          size * 0.02
        }px 0 rgba(255,255,255,0.35), inset 0 -${size * 0.08}px ${size * 0.2}px rgba(5,20,60,0.35)`,
        overflow: 'hidden',
      }}
    >
      {/* Top sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 45%, transparent 55%)',
        }}
      />
    </div>
    <FastForwardGlyph
      size={size}
      style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
    />
  </div>
);

/** "Skipper AI" — white wordmark with the website's AI gradient on "AI". */
export const Wordmark: React.FC<{ size: number; style?: React.CSSProperties }> = ({
  size,
  style,
}) => (
  <div
    style={{
      fontFamily: FONT.display,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: '-0.035em',
      lineHeight: 1,
      color: C.text,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    Skipper{' '}
    <span
      style={{
        backgroundImage: AI_GRADIENT,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      AI
    </span>
  </div>
);
