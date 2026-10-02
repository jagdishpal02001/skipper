import React from 'react';
import { C, FONT } from '../theme';
import { alpha, clamp, mix } from '../lib/anim';

/* ------------------------------------------------------------------------ *
 * Skipper's own UI, rebuilt from the extension source at video scale:
 *   - SkipToast      ← src/content/widget/widget.css (.skipper-toast)
 *   - RatingChip     ← src/content/services/SentimentBadge.ts (.chip)
 *   - RatingPopover  ← SentimentBadge.popoverHtml
 *   - PopupCard etc. ← src/components (Card, StatBadge) + SettingsPanel pills
 * ------------------------------------------------------------------------ */

export const SkipToast: React.FC<{
  text: string;
  scale?: number;
  accent?: string;
  style?: React.CSSProperties;
}> = ({ text, scale = 1.7, accent = '#3b82f6', style }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12 * scale,
      background: 'rgba(20, 22, 28, 0.86)',
      backdropFilter: 'blur(12px)',
      color: '#f3f4f6',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderLeft: `${3 * scale}px solid ${accent}`,
      borderRadius: 10 * scale,
      padding: `${8 * scale}px ${14 * scale}px`,
      fontSize: 12.5 * scale,
      fontWeight: 500,
      fontFamily: FONT.ui,
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <span>{text}</span>
    <span
      style={{
        background: 'rgba(59, 130, 246, 0.15)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        color: '#60a5fa',
        fontWeight: 600,
        fontSize: 11 * scale,
        padding: `${4 * scale}px ${10 * scale}px`,
        borderRadius: 6 * scale,
      }}
    >
      Undo
    </span>
  </div>
);

export const ratingColor = (rating: number): string =>
  rating >= 7 ? C.ratingGood : rating >= 4 ? '#e0a82e' : C.ratingPoor;

/** The ✦ chip next to like/dislike. `loading` shows the spinning-star state. */
export const RatingChip: React.FC<{
  rating: number;
  loading: number;
  t: number;
  scale?: number;
  open?: boolean;
}> = ({ rating, loading, t, scale = 1, open }) => {
  const color = ratingColor(rating);
  const resolved = 1 - loading;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5 * scale,
        padding: `0 ${14 * scale}px`,
        height: 36 * scale,
        borderRadius: 18 * scale,
        background: open ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: open ? `inset 0 0 0 ${1.5 * scale}px ${alpha(color, 0.45)}` : undefined,
        fontFamily: FONT.ui,
        fontSize: 13 * scale,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: loading > 0.5 ? '#aab2bd' : color,
        opacity: loading > 0.5 ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 4.5)) : 1,
      }}
    >
      <span
        style={{
          fontSize: 14 * scale,
          display: 'inline-block',
          transform: `rotate(${loading > 0.5 ? (t * 225) % 360 : 0}deg)`,
        }}
      >
        ✦
      </span>
      {resolved > 0.5 ? (
        <span>
          {rating.toFixed(1)}
          <span style={{ opacity: 0.6, fontWeight: 400 }}>/10</span>
        </span>
      ) : (
        <span>…</span>
      )}
    </div>
  );
};

export interface Split {
  positive: number;
  neutral: number;
  negative: number;
}

export const RatingPopover: React.FC<{
  rating: number;
  sampleSize: number;
  split: Split;
  summary: string;
  /** 0 → 1: bars grow (skipper-grow keyframes). */
  fill: number;
  /** 0 → 1: summary text in. */
  text: number;
  scale?: number;
}> = ({ rating, sampleSize, split, summary, fill, text, scale = 1 }) => {
  const color = ratingColor(rating);
  const parts = [
    { label: 'Positive', value: split.positive, color: C.ratingGood },
    { label: 'Neutral', value: split.neutral, color: C.neutral },
    { label: 'Negative', value: split.negative, color: C.ratingPoor },
  ];
  return (
    <div
      style={{
        width: 300 * scale,
        padding: 14 * scale,
        borderRadius: 12 * scale,
        background: 'rgba(18,20,24,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
        fontFamily: FONT.ui,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 * scale, marginBottom: 10 * scale }}>
        <span style={{ fontSize: 18 * scale, fontWeight: 700, color }}>{rating.toFixed(1)}/10</span>
        <span style={{ fontSize: 11 * scale, color: '#8b929e' }}>
          audience rating · {sampleSize} comments
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 8 * scale,
          borderRadius: 4 * scale,
          overflow: 'hidden',
          background: C.surface600,
          marginBottom: 8 * scale,
        }}
      >
        {parts.map((p) => (
          <div
            key={p.label}
            style={{
              width: `${p.value * clamp(fill)}%`,
              background: p.color,
              height: '100%',
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11 * scale,
          marginBottom: 10 * scale,
        }}
      >
        {parts.map((p) => (
          <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 * scale }}>
            <span
              style={{
                width: 8 * scale,
                height: 8 * scale,
                borderRadius: 2 * scale,
                background: p.color,
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#aab2bd' }}>
              {p.label} {Math.round(p.value * clamp(fill))}%
            </span>
          </span>
        ))}
      </div>
      <div
        style={{
          fontSize: 12 * scale,
          lineHeight: 1.5,
          color: '#d7dbe0',
          opacity: text,
          transform: `translateY(${mix(6, 0, text)}px)`,
        }}
      >
        {summary}
      </div>
      <div style={{ marginTop: 8 * scale, fontSize: 10 * scale, color: '#6b7280', opacity: text }}>
        Skipper · AI verdict from top comments — may be imperfect
      </div>
    </div>
  );
};

/** src/components/Card.tsx */
export const PopupCard: React.FC<{
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  scale?: number;
  style?: React.CSSProperties;
}> = ({ title, action, children, scale = 1, style }) => (
  <section
    style={{
      borderRadius: 12 * scale,
      border: '1px solid rgba(255,255,255,0.05)',
      background: C.surface800,
      padding: 12 * scale,
      fontFamily: FONT.body,
      ...style,
    }}
  >
    {(title || action) && (
      <header
        style={{
          marginBottom: 8 * scale,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {title && (
          <h2
            style={{
              margin: 0,
              fontSize: 12 * scale,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.025em',
              color: '#9ca3af',
            }}
          >
            {title}
          </h2>
        )}
        {action}
      </header>
    )}
    {children}
  </section>
);

/** src/components/StatBadge.tsx — with a highlight pulse when the value changes. */
export const StatBadge: React.FC<{ value: string; label: string; scale?: number; pulse?: number }> = ({
  value,
  label,
  scale = 1,
  pulse = 0,
}) => (
  <div
    style={{
      flex: 1,
      borderRadius: 8 * scale,
      background: C.surface700,
      padding: `${8 * scale}px ${10 * scale}px`,
      textAlign: 'center',
      boxShadow: pulse > 0 ? `inset 0 0 0 ${1.5 * scale}px ${alpha(C.brand400, pulse * 0.8)}, 0 0 ${24 * pulse}px ${alpha(C.brand500, pulse * 0.45)}` : undefined,
    }}
  >
    <div
      style={{
        fontSize: 18 * scale,
        fontWeight: 700,
        color: '#fff',
        transform: `scale(${1 + pulse * 0.12})`,
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: 10 * scale,
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
        color: '#9ca3af',
      }}
    >
      {label}
    </div>
  </div>
);

/** A skip-category pill from SettingsPanel. */
export const CategoryPill: React.FC<{ label: string; active: number; scale?: number; dot?: string }> = ({
  label,
  active,
  scale = 1,
  dot,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6 * scale,
      borderRadius: 999,
      padding: `${4 * scale}px ${10 * scale}px`,
      fontSize: 12 * scale,
      fontWeight: 600,
      fontFamily: FONT.body,
      border: `1px solid ${active > 0.5 ? C.brand500 : 'rgba(255,255,255,0.05)'}`,
      background: active > 0.5 ? alpha(C.brand500, 0.2) : alpha(C.surface700, 0.4),
      color: active > 0.5 ? C.brand400 : '#9ca3af',
      transform: `scale(${1 + Math.sin(clamp(active) * Math.PI) * 0.12})`,
    }}
  >
    {dot ? (
      <span style={{ width: 7 * scale, height: 7 * scale, borderRadius: '50%', background: dot }} />
    ) : null}
    {label}
  </span>
);
