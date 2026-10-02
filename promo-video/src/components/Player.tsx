import React from 'react';
import { C, FONT } from '../theme';
import { alpha, clamp, timestamp } from '../lib/anim';
import { Icon } from './Icons';

export interface PlayerSegment {
  /** Video seconds. */
  start: number;
  end: number;
  color: string;
  /** 0 → 1: marker paints in (the analysis result arriving). */
  reveal: number;
  /** 0 → 1: brightened, as when the playhead is inside it. */
  active: number;
  /** 0 → 1: the timeline tooltip above the marker. */
  tag?: number;
  tagText?: string;
}

interface PlayerProps {
  width: number;
  videoTime: number;
  videoDuration: number;
  segments: PlayerSegment[];
  /** 0 → 1 analysis sweep across the bar; undefined hides it. */
  scan?: number;
  playing?: boolean;
  /** Motion streak left by a skip, in video seconds. */
  trail?: { from: number; to: number; opacity: number } | null;
  title: string;
  channel: string;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
}

const BAR_INSET = 26;
const BAR_BOTTOM = 72;
const BAR_HEIGHT = 8;

/** x (px, player space) of a video time on the progress bar. */
export const barX = (width: number, fraction: number): number =>
  BAR_INSET + (width - BAR_INSET * 2) * clamp(fraction);

/**
 * A stylised video player — deliberately generic rather than a copy of
 * YouTube's — carrying Skipper's real timeline markers (TimelineMarkers.ts
 * colours) and tooltip.
 */
export const Player: React.FC<PlayerProps> = ({
  width,
  videoTime,
  videoDuration,
  segments,
  scan,
  playing = true,
  trail,
  title,
  channel,
  children,
  overlay,
  style,
}) => {
  const height = (width * 9) / 16;
  const p = clamp(videoTime / videoDuration);
  const barW = width - BAR_INSET * 2;

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 24,
        overflow: 'hidden',
        background: '#000',
        boxShadow:
          '0 50px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.06)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>

      {/* Top shade + title */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 150,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: FONT.ui,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f472b6, #8b5cf6)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          {channel[0]}
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 23, fontWeight: 500, lineHeight: 1.2 }}>{title}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 2 }}>{channel}</div>
        </div>
      </div>

      {/* Bottom shade */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 190,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          left: BAR_INSET,
          width: barW,
          bottom: BAR_BOTTOM,
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          background: 'rgba(255,255,255,0.22)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${clamp(p + 0.12) * 100}%`,
            borderRadius: BAR_HEIGHT / 2,
            background: 'rgba(255,255,255,0.32)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${p * 100}%`,
            borderRadius: BAR_HEIGHT / 2,
            background: C.ytRed,
          }}
        />

        {/* Skipper markers */}
        {segments.map((s, i) => {
          const left = (s.start / videoDuration) * 100;
          const w = ((s.end - s.start) / videoDuration) * 100;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${w}%`,
                top: -1,
                bottom: -1,
                borderRadius: 3,
                background: alpha(s.color, 0.78 + s.active * 0.22),
                clipPath: `inset(0 ${(1 - s.reveal) * 100}% 0 0)`,
                boxShadow: `0 0 ${10 + s.active * 26}px ${alpha(s.color, 0.35 + s.active * 0.55)}`,
                transform: `scaleY(${1 + s.active * 0.6})`,
              }}
            />
          );
        })}

        {/* Skip streak */}
        {trail && trail.opacity > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              left: `${(trail.from / videoDuration) * 100}%`,
              width: `${((trail.to - trail.from) / videoDuration) * 100}%`,
              top: -6,
              bottom: -6,
              borderRadius: 10,
              opacity: trail.opacity,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 70%, rgba(255,255,255,0.95) 100%)',
              filter: 'blur(3px)',
            }}
          />
        ) : null}

        {/* Analysis sweep */}
        {scan !== undefined && scan > 0 && scan < 1 ? (
          <>
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: `${scan * 100}%`,
                top: -10,
                bottom: -10,
                background: `linear-gradient(90deg, transparent 70%, ${alpha(C.brand400, 0.35)} 100%)`,
                borderRadius: 6,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${scan * 100}%`,
                top: -22,
                bottom: -22,
                width: 4,
                marginLeft: -2,
                borderRadius: 2,
                background: '#fff',
                boxShadow: `0 0 18px 6px ${alpha(C.brand400, 0.9)}`,
              }}
            />
          </>
        ) : null}

        {/* Scrubber */}
        <div
          style={{
            position: 'absolute',
            left: `${p * 100}%`,
            top: '50%',
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
            borderRadius: '50%',
            background: C.ytRed,
            boxShadow: '0 0 0 4px rgba(255,0,51,0.25), 0 2px 6px rgba(0,0,0,0.5)',
          }}
        />

        {/* Timeline tooltips (TimelineMarkers.showTooltip) */}
        {segments.map((s, i) =>
          s.tag && s.tag > 0.01 && s.tagText ? (
            <div
              key={`tag-${i}`}
              style={{
                position: 'absolute',
                left: `${(((s.start + s.end) / 2) / videoDuration) * 100}%`,
                bottom: 22,
                transform: `translate(-50%, ${(1 - s.tag) * 10}px)`,
                opacity: s.tag,
                padding: '8px 14px',
                background: 'rgba(20,20,20,0.95)',
                color: s.color,
                fontFamily: FONT.ui,
                fontSize: 18,
                fontWeight: 700,
                borderRadius: 6,
                border: `1px solid ${alpha(s.color, 0.45)}`,
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 16px rgba(0,0,0,0.55)',
              }}
            >
              {s.tagText}
            </div>
          ) : null,
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 16,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          color: '#fff',
          fontFamily: FONT.ui,
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={30} color="#fff" fill="#fff" strokeWidth={1.5} />
        <Icon name="skipForward" size={28} color="#fff" fill="#fff" strokeWidth={1.5} />
        <Icon name="volume" size={30} color="#fff" />
        <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '0.01em' }}>
          {timestamp(videoTime)} <span style={{ color: 'rgba(255,255,255,0.65)' }}>/ {timestamp(videoDuration)}</span>
        </div>
        <div style={{ flex: 1 }} />
        <Icon name="settings" size={28} color="#fff" />
        <Icon name="maximize" size={28} color="#fff" />
      </div>

      {overlay}
    </div>
  );
};
