import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT } from '../theme';
import { SPRING, alpha, clamp, ease, mix, prog, spring, useTime } from '../lib/anim';
import { AppIcon, FastForwardGlyph, Wordmark } from '../components/Brand';
import { Icon } from '../components/Icons';
import type { IconName } from '../components/Icons';
import { Sfx } from '../components/Sfx';

/* 0.0 – 3.25  Captions everyone has sat through pile up, faster and faster.
 * 3.25 – 4.0  A fast-forward glyph tears across and skips all of it.
 * 4.0         The glyph lands; the app tile slams in around it (the drop).
 * 4.45 – 6.0  Wordmark slides out, the three promises tick in on the beat.
 * 7.5 – 8.3   Zoom through into the first feature.                        */

const CAPTIONS = [
  { at: 0.3, text: 'This video is sponsored by…', x: -400, y: -250, rot: -4, size: 54 },
  { at: 0.8, text: 'Use code YOUTUBE for 20% off!', x: 400, y: -130, rot: 3, size: 50 },
  { at: 1.3, text: 'But first — smash that like button', x: -360, y: 30, rot: -2, size: 50 },
  { at: 1.8, text: 'Check out my merch, link below!', x: 420, y: 170, rot: 4, size: 48 },
  { at: 2.2, text: "Don't forget to subscribe!", x: -170, y: 310, rot: -3, size: 48 },
  { at: 2.45, text: "Today's video is brought to you by…", x: 210, y: -345, rot: 2, size: 42 },
  { at: 2.7, text: "…and if you're new here", x: -600, y: 205, rot: 5, size: 42 },
  { at: 2.9, text: 'Hit the bell!', x: 640, y: -15, rot: -5, size: 46 },
  { at: 3.05, text: 'Before we begin…', x: 60, y: -80, rot: 1.5, size: 46 },
];

const SWEEP = 3.25;
const LAND = 4.0;
const GLYPH = 230;
/** The blast front that blows captions away, in px from centre. */
const front = (t: number) => -1150 + (t - SWEEP) * 6800;
const glyphX = (t: number) => mix(-1350, 0, prog(t, SWEEP, 0.72, ease.outExpo));

const PROMISES: Array<{ icon: IconName; label: string; color: string; at: number }> = [
  { icon: 'skipForward', label: 'Skip sponsors', color: C.sponsor, at: 5.1 },
  { icon: 'sparkle', label: 'See real ratings', color: '#fbbf24', at: 5.5 },
  { icon: 'clock', label: 'Own your watch time', color: C.brand400, at: 5.9 },
];

const SPEED_LINES = Array.from({ length: 16 }, (_, i) => ({
  y: ((i * 137) % 900) - 450,
  len: 260 + ((i * 89) % 520),
  lag: ((i * 53) % 400) + 80,
  w: 2 + (i % 3),
}));

export const IntroScene: React.FC = () => {
  const t = useTime();

  // A tiny camera kick each time a caption lands.
  const shake = CAPTIONS.reduce((acc, c) => {
    const d = t - c.at;
    return d > 0 && t < SWEEP ? acc + Math.exp(-d * 14) * Math.sin(d * 70 + c.x) * 5 : acc;
  }, 0);
  const tension = prog(t, 2.2, 1.0, ease.inCubic) * (t < LAND ? 1 : 0);

  const tile = spring(t, LAND, SPRING.pop);
  const reveal = spring(t, 4.45, SPRING.soft);
  const exit = prog(t, 7.5, 0.8, ease.inQuart);
  // Once the promises arrive, lift the lock-up so the whole group sits centred.
  const lift = -95 * spring(t, 4.85, SPRING.soft);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* --- Caption pile-up --------------------------------------------- */}
      <AbsoluteFill
        style={{
          transform: `translate(${shake}px, ${shake * 0.6}px) scale(${1 + tension * 0.05})`,
        }}
      >
        {CAPTIONS.map((c, i) => {
          const s = spring(t, c.at, SPRING.bouncy);
          if (s <= 0) return null;
          const blowStart = SWEEP + (c.x + 1150) / 6800;
          const blow = prog(t, blowStart, 0.42, ease.inCubic);
          if (blow >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${c.x + blow * 1500}px, ${c.y}px) rotate(${
                  c.rot + (1 - s) * 10
                }deg) scale(${mix(0.4, 1, s) * (1 + blow * 0.2)}, ${mix(0.4, 1, s) * (1 - blow * 0.3)})`,
                opacity: clamp(s * 3) * (1 - blow),
                filter: blow > 0 ? `blur(${blow * 14}px)` : undefined,
                background: 'rgba(8, 8, 8, 0.8)',
                color: '#fff',
                fontFamily: FONT.ui,
                fontWeight: 500,
                fontSize: c.size,
                padding: '8px 18px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}
            >
              {c.text}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* --- The sweep ---------------------------------------------------- */}
      {t > SWEEP && t < LAND + 0.2 ? (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          {SPEED_LINES.map((l, i) => {
            const x = front(t) - l.lag;
            const o = (1 - prog(t, SWEEP + 0.35, 0.3, ease.linear)) * 0.55;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 960 + x - l.len,
                  top: 540 + l.y,
                  width: l.len,
                  height: l.w,
                  borderRadius: l.w,
                  opacity: o,
                  background: `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.9)})`,
                }}
              />
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 960 + front(t) - 500,
              top: 0,
              width: 500,
              height: 1080,
              opacity: 0.35 * (1 - prog(t, SWEEP + 0.3, 0.3, ease.linear)),
              background: `linear-gradient(90deg, transparent, ${alpha(C.brand400, 0.6)})`,
              filter: 'blur(30px)',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* Glyph + ghost trail, until the tile takes over */}
      {t > SWEEP && t < LAND + 0.02 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          {[6, 5, 4, 3, 2, 1, 0].map((k) => {
            const x = glyphX(t - k * 0.016);
            const v = Math.abs(glyphX(t) - glyphX(t - 0.03));
            return (
              <FastForwardGlyph
                key={k}
                size={GLYPH}
                style={{
                  position: 'absolute',
                  transform: `translateX(${x}px) scaleX(${1 + clamp(v / 400) * 0.6})`,
                  opacity: k === 0 ? 1 : 0.32 * (1 - k / 7),
                  filter: k === 0 ? `drop-shadow(0 0 40px ${alpha(C.brand400, 0.9)})` : undefined,
                }}
              />
            );
          })}
        </AbsoluteFill>
      ) : null}

      {/* --- Logo --------------------------------------------------------- */}
      {t >= LAND ? (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${1 + exit * 0.35})`,
            opacity: 1 - exit,
            filter: exit > 0 ? `blur(${exit * 14}px)` : undefined,
          }}
        >
          {/* Shockwave + flash at the drop */}
          <div
            style={{
              position: 'absolute',
              width: 240,
              height: 240,
              borderRadius: '50%',
              border: `3px solid ${alpha('#cfe3ff', 0.8)}`,
              transform: `scale(${mix(1, 7, prog(t, LAND, 0.9, ease.outCubic))})`,
              opacity: 1 - prog(t, LAND, 0.9, ease.outCubic),
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 1400,
              height: 1400,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha('#9cc7ff', 0.55)} 0%, transparent 55%)`,
              opacity: 1 - prog(t, LAND, 0.6, ease.outCubic),
            }}
          />
          {/* Slow halo behind the tile */}
          <div
            style={{
              position: 'absolute',
              width: 900,
              height: 900,
              borderRadius: '50%',
              background: `conic-gradient(from ${t * 40}deg, ${alpha(C.brand500, 0)}, ${alpha(
                C.brand500,
                0.35,
              )}, ${alpha(C.geminiPurple, 0)}, ${alpha(C.geminiCyan, 0.25)}, ${alpha(C.brand500, 0)})`,
              filter: 'blur(60px)',
              opacity: tile * 0.8,
              transform: `translateY(-60px) translateX(${-reveal * 0}px)`,
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 540 - GLYPH / 2 + lift,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <AppIcon size={GLYPH} tile={tile} glow={tile} />
              <div
                style={{
                  maxWidth: reveal * 820,
                  marginLeft: reveal * 48,
                  overflow: 'hidden',
                  paddingBottom: 10,
                  marginBottom: -10,
                }}
              >
                <Wordmark
                  size={172}
                  style={{
                    transform: `translateX(${(1 - reveal) * -60}px)`,
                    opacity: clamp(reveal * 1.5),
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 540 + GLYPH / 2 + 70 + lift,
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
            }}
          >
            {PROMISES.map((p) => {
              const s = spring(t, p.at, SPRING.pop);
              return (
                <div
                  key={p.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 32px 16px 18px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.11)',
                    boxShadow: `0 0 40px ${alpha(p.color, 0.14)}`,
                    fontFamily: FONT.body,
                    fontWeight: 600,
                    fontSize: 38,
                    color: '#e5e7eb',
                    opacity: clamp(s * 2),
                    transform: `translateY(${(1 - s) * 30}px) scale(${mix(0.85, 1, s)})`,
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 54,
                      height: 54,
                      borderRadius: '50%',
                      background: alpha(p.color, 0.16),
                    }}
                  >
                    <Icon
                      name={p.icon}
                      size={30}
                      color={p.color}
                      fill={p.icon === 'clock' ? 'none' : p.color}
                    />
                  </span>
                  {p.label}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {CAPTIONS.map((c, i) => (
        <Sfx key={i} name="pop" at={c.at} volume={0.35 + i * 0.04} />
      ))}
      <Sfx name="sweep" at={SWEEP - 0.12} volume={0.9} />
      <Sfx name="impact" at={LAND} volume={1} />
      <Sfx name="shimmer" at={4.4} volume={0.45} />
      {PROMISES.map((p) => (
        <Sfx key={p.label} name="pop" at={p.at} volume={0.4} />
      ))}
      <Sfx name="whoosh" at={7.55} volume={0.55} />
    </AbsoluteFill>
  );
};
