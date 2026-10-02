import React from 'react';
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Background } from './components/Background';
import { SECTIONS, TOTAL_SECONDS } from './timing';
import type { SectionId } from './timing';
import { IntroScene } from './scenes/IntroScene';
import { SkipScene } from './scenes/SkipScene';
import { CascadeScene } from './scenes/CascadeScene';
import { RatingsScene } from './scenes/RatingsScene';
import { DashboardScene } from './scenes/DashboardScene';
import { BenefitsScene } from './scenes/BenefitsScene';
import { CtaScene } from './scenes/CtaScene';

const SCENES: Record<SectionId, React.FC> = {
  intro: IntroScene,
  skip: SkipScene,
  cascade: CascadeScene,
  ratings: RatingsScene,
  dashboard: DashboardScene,
  benefits: BenefitsScene,
  cta: CtaScene,
};

/**
 * Scenes start exactly on their bar line and run TAIL seconds past it, so each
 * exit overlaps the next scene's entrance instead of cutting to an empty frame.
 */
const TAIL = 0.5;

export const Promo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#07090e' }}>
      <Background />
      {SECTIONS.map((s) => {
        const Scene = SCENES[s.id];
        const from = Math.round(s.start * fps);
        const end = Math.min(TOTAL_SECONDS, s.start + s.duration + TAIL);
        return (
          <Sequence key={s.id} from={from} durationInFrames={Math.round(end * fps) - from} name={s.id}>
            <Scene />
          </Sequence>
        );
      })}
      <Html5Audio src={staticFile('audio/music.wav')} />
    </AbsoluteFill>
  );
};
