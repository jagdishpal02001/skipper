import timing from './timing.json';

/**
 * Single source of truth for the edit. Every scene boundary sits on a bar line
 * of the soundtrack (scripts/generate-audio.mjs reads the same JSON), so cuts
 * land on the beat.
 */
export const BPM = timing.bpm;
export const FPS = timing.fps;
export const WIDTH = timing.width;
export const HEIGHT = timing.height;

export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

export type SectionId =
  | 'intro'
  | 'skip'
  | 'cascade'
  | 'ratings'
  | 'dashboard'
  | 'benefits'
  | 'cta';

export interface Section {
  id: SectionId;
  /** Start, in seconds from the top of the video. */
  start: number;
  /** Length, in seconds. */
  duration: number;
}

export const SECTIONS: Section[] = (() => {
  let cursor = 0;
  return timing.sections.map((s) => {
    const section = { id: s.id as SectionId, start: cursor, duration: s.bars * BAR };
    cursor += section.duration;
    return section;
  });
})();

export const TOTAL_SECONDS = SECTIONS.reduce((sum, s) => sum + s.duration, 0);
export const TOTAL_FRAMES = Math.round(TOTAL_SECONDS * FPS);

export const sectionById = (id: SectionId): Section => {
  const found = SECTIONS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown section ${id}`);
  return found;
};
