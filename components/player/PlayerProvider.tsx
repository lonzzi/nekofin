import { useMemo, type PropsWithChildren } from 'react';

import {
  PlayerContext,
  type PlayerLifecycleState,
  type PlayerPlaybackState,
} from './PlayerContext';
import { canSeekPlayback } from './playerControlModel';
import { usePlayerControls, type PlayerControlsOptions } from './usePlayerControls';

const DEFAULT_LIFECYCLE: PlayerLifecycleState = {
  entryVisible: true,
  isExiting: false,
  exitPreparation: null,
};

export type PlayerPlaybackInput = Omit<PlayerPlaybackState, 'canSeek' | 'isMovie'>;

export function PlayerProvider({
  children,
  lifecycle = DEFAULT_LIFECYCLE,
  playback: input,
  controlsOptions,
}: PropsWithChildren<{
  lifecycle?: PlayerLifecycleState;
  playback: PlayerPlaybackInput;
  controlsOptions?: PlayerControlsOptions;
}>) {
  const playback = useMemo(
    () => ({
      ...input,
      canSeek: canSeekPlayback({ durationMs: input.duration, isPlayerReady: input.isPlayerReady }),
      isMovie: input.currentItem?.type === 'Movie',
      mediaStats: input.mediaStats ?? null,
      hdrState: input.hdrState ?? null,
    }),
    [input],
  );
  const { controls, panels } = usePlayerControls(playback, lifecycle, controlsOptions);

  return (
    <PlayerContext value={{ lifecycle, playback, controls, panels }}>{children}</PlayerContext>
  );
}
