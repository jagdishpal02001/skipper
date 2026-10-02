import React from 'react';
import { Html5Audio, Sequence, staticFile, useVideoConfig } from 'remotion';

export type SfxName =
  | 'pop'
  | 'tick'
  | 'whoosh'
  | 'sweep'
  | 'impact'
  | 'skip'
  | 'chime'
  | 'click'
  | 'shimmer'
  | 'slam'
  | 'swell';

/** Places a generated sound effect (public/sfx) at a scene-local time. */
export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({
  name,
  at,
  volume = 1,
}) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.round(at * fps)} layout="none" name={`sfx:${name}`}>
      <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};
