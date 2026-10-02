import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT } from '../theme';
import {
  SPRING,
  alpha,
  clamp,
  duration,
  ease,
  keys,
  mix,
  prog,
  spring,
  timestamp,
  useTime,
} from '../lib/anim';
import type { Ease } from '../lib/anim';
import { Player, barX } from '../components/Player';
import type { PlayerSegment } from '../components/Player';
import { PromoFrame, SponsorFrame, TutorialFrame } from '../components/VideoContent';
import { CategoryPill, PopupCard, SkipToast, StatBadge } from '../components/ProductUI';
import { Kicker, RevealText } from '../components/Typography';
import { Cursor } from '../components/Cursor';
import { Sfx } from '../components/Sfx';

/* 0.0   Headline; the player rises in, the popup slides in beside it.
 * 1.3   Skipper's analysis sweeps the timeline and paints the markers.
 * 3.55  Playhead reaches the sponsor read; camera pushes in on the bar.
 * 3.85  SKIP. Toast + popup stats update. Camera eases back out.
 * 6.55  Second skip: the merch plug.
 * 7.7   The user switches on "Intros" — you choose what goes.
 * 9.5   Exit up into the next scene.                                     */

const VIDEO_LENGTH = 750; // 12:30
const SEG = {
  intro: { start: 0, end: 20, color: C.intro, label: 'Intro' },
  sponsor: { start: 222, end: 297, color: C.sponsor, label: 'Sponsored segment' },
  promo: { start: 555, end: 598, color: C.selfPromo, label: 'Self-promotion' },
};

const SCAN_START = 1.3;
const SCAN_LEN = 0.9;
const SKIP1 = 3.85;
const TOAST1 = 4.0;
const SKIP2 = 6.55;
const TOAST2 = 6.7;
const INTRO_CLICK = 7.75;
const EXIT = 9.55;

const PLAYER = { x: 120, y: 250, w: 1180 };
const PLAYER_H = (PLAYER.w * 9) / 16;
const BAR_Y = PLAYER.y + PLAYER_H - 76; // progress-bar centre, scene space

const scanAt = (t: number) => prog(t, SCAN_START, SCAN_LEN, ease.inOutCubic);
/** When the analysis sweep reaches a fraction of the bar. */
const scanReaches = (frac: number): number => {
  let lo = SCAN_START;
  let hi = SCAN_START + SCAN_LEN;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (scanAt(mid) < frac) lo = mid;
    else hi = mid;
  }
  return hi;
};

/** Playhead position (video seconds) over scene time. */
const PLAYHEAD: Array<[number, number, Ease]> = [
  [0, 21, ease.linear],
  [1.25, 21, ease.inOutCubic],
  [3.55, 222, ease.linear],
  [SKIP1, 226, ease.outExpo],
  [SKIP1 + 0.16, 297, ease.inOutCubic],
  [6.35, 555, ease.linear],
  [SKIP2, 557, ease.outExpo],
  [SKIP2 + 0.13, 598, ease.outCubic],
  [10.5, 642, ease.linear],
];
const videoTimeAt = (t: number): number => {
  for (let i = 0; i < PLAYHEAD.length - 1; i++) {
    const [t0, v0] = PLAYHEAD[i]!;
    const [t1, v1, e] = PLAYHEAD[i + 1]!;
    if (t <= t1) return t <= t0 ? v0 : mix(v0, v1, e((t - t0) / (t1 - t0)));
  }
  return PLAYHEAD[PLAYHEAD.length - 1]![1];
};

const markerTick = (s: { start: number }) => scanReaches(s.start / VIDEO_LENGTH + 0.004);

export const SkipScene: React.FC = () => {
  const t = useTime();
  const vt = videoTimeAt(t);
  const scan = scanAt(t);

  // --- camera -------------------------------------------------------------
  const zoom = keys(t, [
    [3.1, 1],
    [3.7, 1.42],
    [4.35, 1.42],
    [5.05, 1],
  ]);
  const focusX = PLAYER.x + barX(PLAYER.w, (SEG.sponsor.start + SEG.sponsor.end) / 2 / VIDEO_LENGTH);
  const exit = prog(t, EXIT, 0.75, ease.inQuart);

  // --- player state ---------------------------------------------------------
  const flash = (at: number) => (t >= at ? Math.exp(-(t - at) * 4) : 0);
  const inside = (s: { start: number; end: number }) => (vt >= s.start && vt < s.end ? 1 : 0);
  const revealOf = (s: { start: number; end: number }) =>
    clamp((scan * VIDEO_LENGTH - s.start) / (s.end - s.start));

  const segments: PlayerSegment[] = [
    { ...SEG.intro, reveal: revealOf(SEG.intro), active: 0 },
    {
      ...SEG.sponsor,
      reveal: revealOf(SEG.sponsor),
      active: Math.max(inside(SEG.sponsor), flash(SKIP1)),
      tag: Math.min(prog(t, TOAST1 + 0.1, 0.3), 1 - prog(t, 5.6, 0.3)),
      tagText: SEG.sponsor.label,
    },
    {
      ...SEG.promo,
      reveal: revealOf(SEG.promo),
      active: Math.max(inside(SEG.promo), flash(SKIP2)),
      tag: Math.min(prog(t, TOAST2 + 0.1, 0.3), 1 - prog(t, 8.3, 0.3)),
      tagText: SEG.promo.label,
    },
  ];

  const trail =
    t >= SKIP1 && t < SKIP2
      ? { from: 226, to: Math.min(vt, 297), opacity: 1 - prog(t, SKIP1 + 0.1, 0.6, ease.outCubic) }
      : t >= SKIP2
        ? { from: 557, to: Math.min(vt, 598), opacity: 1 - prog(t, SKIP2 + 0.1, 0.6, ease.outCubic) }
        : null;

  const glitch = Math.max(
    1 - clamp(Math.abs(t - (SKIP1 + 0.06)) / 0.14),
    1 - clamp(Math.abs(t - (SKIP2 + 0.05)) / 0.12),
  );

  let content: React.ReactNode = <TutorialFrame videoTime={vt} t={t} />;
  if (vt >= SEG.sponsor.start && vt < SEG.sponsor.end) content = <SponsorFrame t={t} />;
  if (vt >= SEG.promo.start && vt < SEG.promo.end) content = <PromoFrame t={t} />;

  const enter = spring(t, 0.15, SPRING.soft);

  // Annotation above the bar while Skipper analyses.
  const found = t >= SCAN_START + SCAN_LEN + 0.05;
  const note = Math.min(prog(t, 1.15, 0.4), 1 - prog(t, 3.05, 0.3, ease.inCubic));

  const toast = (at: number, out: number) => {
    const s = spring(t, at, SPRING.pop);
    const o = prog(t, out, 0.3, ease.inCubic);
    return { opacity: clamp(s * 2) * (1 - o), y: (1 - s) * 24 + o * 10 };
  };
  const t1 = toast(TOAST1, 5.6);
  const t2 = toast(TOAST2, 8.4);

  // --- popup stats ------------------------------------------------------------
  const found1 = markerTick(SEG.intro);
  const found2 = markerTick(SEG.sponsor);
  const found3 = markerTick(SEG.promo);
  const sponsors = [found1, found2, found3].filter((at) => t >= at).length;
  const saved =
    75 * prog(t, TOAST1, 0.5, ease.outCubic) + 43 * prog(t, TOAST2, 0.5, ease.outCubic);
  const skips = (t >= TOAST1 ? 1 : 0) + (t >= TOAST2 ? 1 : 0);
  const pulse = (at: number) => (t >= at ? Math.exp(-(t - at) * 3.5) : 0);
  const statusText = t < SCAN_START - 0.1 ? 'Waiting for video' : t < SCAN_START + SCAN_LEN ? 'Analyzing…' : 'Ready';

  const popupIn = spring(t, 0.9, SPRING.soft);
  const settingsIn = spring(t, 1.15, SPRING.soft);
  const sublineIn = 0.55;

  // Cursor glides in to switch on Intros.
  const cursorIn = prog(t, 6.9, 0.8, ease.inOutCubic);
  const cursorOut = prog(t, 8.9, 0.5, ease.inCubic);
  const press = Math.max(0, 1 - Math.abs(t - INTRO_CLICK) / 0.1);
  const introOn = t >= INTRO_CLICK ? 1 : 0;
  const PILL_TARGET = { x: 1612, y: 905 };

  return (
    <AbsoluteFill
      style={{
        transformOrigin: `${focusX}px ${BAR_Y - 60}px`,
        transform: `scale(${zoom}) translateY(${-exit * 90}px)`,
        opacity: 1 - exit,
        filter: exit > 0 ? `blur(${exit * 10}px)` : undefined,
      }}
    >
      {/* Headline */}
      <div style={{ position: 'absolute', left: PLAYER.x, top: 64 }}>
        <Kicker index="01" label="Auto-skip" start={0} color={C.sponsor} />
        <RevealText
          text="Sponsors? *Skipped.*"
          start={0.1}
          style={{
            marginTop: 18,
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 92,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            color: C.text,
          }}
          gradient={`linear-gradient(120deg, #6ee7a8 0%, ${C.sponsor} 45%, #22d3ee 100%)`}
        />
      </div>

      {/* Player */}
      <div
        style={{
          position: 'absolute',
          left: PLAYER.x,
          top: PLAYER.y,
          perspective: 2200,
        }}
      >
        <div
          style={{
            transform: `translateY(${(1 - enter) * 120}px) rotateX(${(1 - enter) * 22}deg) scale(${mix(
              0.92,
              1,
              enter,
            )})`,
            transformOrigin: '50% 100%',
            opacity: clamp(enter * 1.6),
          }}
        >
          <Player
            width={PLAYER.w}
            videoTime={vt}
            videoDuration={VIDEO_LENGTH}
            segments={segments}
            scan={scan}
            trail={trail}
            title="Building a design system from scratch"
            channel="Code with Ava"
            overlay={
              <>
                {/* Skip streak over the picture */}
                {glitch > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.35 * glitch)}, transparent)`,
                      transform: `translateX(${(1 - glitch) * 400}px) skewX(-12deg)`,
                      mixBlendMode: 'screen',
                    }}
                  />
                ) : null}
                {/* Analysis annotation */}
                {note > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 26,
                      bottom: 108,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 20px',
                      borderRadius: 14,
                      background: 'rgba(12,14,20,0.82)',
                      border: `1px solid ${alpha(found ? C.sponsor : C.brand400, 0.5)}`,
                      boxShadow: `0 0 30px ${alpha(found ? C.sponsor : C.brand500, 0.3)}`,
                      fontFamily: FONT.body,
                      fontWeight: 600,
                      fontSize: 24,
                      color: '#fff',
                      opacity: note,
                      transform: `translateY(${(1 - note) * 12}px)`,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        color: found ? C.sponsor : C.brand400,
                        transform: `rotate(${found ? 0 : t * 300}deg)`,
                      }}
                    >
                      {found ? '✓' : '✦'}
                    </span>
                    {found ? 'Skipper found 3 segments' : 'Skipper is finding segments…'}
                  </div>
                ) : null}
                {/* Toasts (ToastStack) */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 122,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  {t1.opacity > 0 ? (
                    <SkipToast
                      text={`Skipped Sponsor Segment (${timestamp(SEG.sponsor.start)} → ${timestamp(SEG.sponsor.end)})`}
                      style={{ opacity: t1.opacity, transform: `translateY(${t1.y}px)` }}
                    />
                  ) : null}
                  {t2.opacity > 0 ? (
                    <SkipToast
                      text={`Skipped Self Promo (${timestamp(SEG.promo.start)} → ${timestamp(SEG.promo.end)})`}
                      style={{ opacity: t2.opacity, transform: `translateY(${t2.y}px)` }}
                    />
                  ) : null}
                </div>
              </>
            }
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: `scaleX(${1 + glitch * 0.06}) translateX(${glitch * -18}px)`,
                filter: glitch > 0 ? `blur(${glitch * 6}px) brightness(${1 + glitch * 0.6})` : undefined,
              }}
            >
              {content}
            </div>
          </Player>
        </div>
      </div>

      {/* Right column: the real popup */}
      <div style={{ position: 'absolute', left: 1352, top: PLAYER.y - 6, width: 448 }}>
        <RevealText
          text="Sponsor reads, self-promos and intros — gone the moment they start."
          start={sublineIn}
          stagger={0.025}
          style={{
            fontFamily: FONT.body,
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.35,
            color: '#cbd5e1',
          }}
        />

        <div
          style={{
            marginTop: 34,
            padding: 14,
            borderRadius: 20,
            background: C.surface900,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
            opacity: clamp(popupIn * 1.5),
            transform: `translateX(${(1 - popupIn) * 80}px)`,
          }}
        >
          {/* Popup header (Popup.tsx) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, fontFamily: FONT.body }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.brand500}, ${C.brand700})`,
                color: '#fff',
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              S
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Skipper</div>
              <div style={{ fontSize: 14, color: '#9ca3af' }}>AI sponsor skipping</div>
            </div>
            <div
              style={{
                width: 54,
                height: 30,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${C.brand600}, ${C.brand500})`,
                boxShadow: '0 0 10px rgba(43,130,246,0.35)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: 27,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                }}
              />
            </div>
          </div>

          <PopupCard
            scale={1.22}
            title="Current Video"
            action={
              <span style={{ fontSize: 14.5, color: '#9ca3af', fontWeight: 600 }}>{statusText}</span>
            }
          >
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                Building a design system from scratch
              </div>
              <div style={{ fontSize: 13.5, color: '#9ca3af', marginTop: 3 }}>Code with Ava</div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <StatBadge
                scale={1.22}
                value={String(sponsors)}
                label="Sponsors"
                pulse={Math.max(pulse(found1), pulse(found2), pulse(found3)) * 0.8}
              />
              <StatBadge scale={1.22} value={duration(saved)} label="Saved" pulse={Math.max(pulse(TOAST1), pulse(TOAST2))} />
              <StatBadge scale={1.22} value={String(skips)} label="Skips" pulse={Math.max(pulse(TOAST1), pulse(TOAST2))} />
            </div>
          </PopupCard>
        </div>

        <div
          style={{
            marginTop: 18,
            opacity: clamp(settingsIn * 1.5),
            transform: `translateX(${(1 - settingsIn) * 80}px)`,
          }}
        >
          <PopupCard scale={1.22} title="Settings" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <div
              style={{
                marginBottom: 10,
                fontSize: 12,
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#9ca3af',
              }}
            >
              Skip categories
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <CategoryPill scale={1.22} label="Sponsors" active={1} dot={C.sponsor} />
              <CategoryPill scale={1.22} label="Self-Promo" active={1} dot={C.selfPromo} />
              <CategoryPill
                scale={1.22}
                label="Intros"
                active={introOn ? 0.5 + 0.5 * clamp((t - INTRO_CLICK) / 0.3) : 0}
                dot={C.intro}
              />
              <CategoryPill scale={1.22} label="Outros" active={0} />
            </div>
          </PopupCard>
        </div>
      </div>

      {cursorIn > 0 && cursorOut < 1 ? (
        <Cursor
          x={mix(1900, PILL_TARGET.x, cursorIn) + cursorOut * 120}
          y={mix(1120, PILL_TARGET.y, cursorIn) + cursorOut * 140}
          press={press}
          ripple={t >= INTRO_CLICK ? prog(t, INTRO_CLICK, 0.5, ease.outCubic) : 0}
          opacity={1 - cursorOut}
        />
      ) : null}

      <Sfx name="whoosh" at={0.12} volume={0.4} />
      <Sfx name="shimmer" at={SCAN_START} volume={0.55} />
      {[found1, found2, found3].map((at, i) => (
        <Sfx key={i} name="tick" at={at} volume={0.7} />
      ))}
      <Sfx name="skip" at={SKIP1 - 0.04} volume={0.95} />
      <Sfx name="pop" at={TOAST1} volume={0.55} />
      <Sfx name="skip" at={SKIP2 - 0.04} volume={0.8} />
      <Sfx name="pop" at={TOAST2} volume={0.5} />
      <Sfx name="click" at={INTRO_CLICK} volume={0.8} />
      <Sfx name="whoosh" at={EXIT} volume={0.5} />
    </AbsoluteFill>
  );
};
