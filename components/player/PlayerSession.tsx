import { parsePlaybackSelection } from '@/services/media/playbackSelection';
import { useMemo, type PropsWithChildren } from 'react';

import { VideoPlayer } from './index';
import type { PlayerLifecycleState } from './PlayerContext';

export type PlayerParams = {
  itemId: string;
  mediaSourceId?: string;
  audioStreamIndex?: string;
  subtitleStreamIndex?: string;
  quality?: string;
};

/** Keep the navigation lifecycle while a new episode remounts its playback session. */
export function PlayerSession({
  params,
  lifecycle,
  children,
}: PropsWithChildren<{ params: PlayerParams; lifecycle: PlayerLifecycleState }>) {
  const { itemId, selection } = useMemo(() => {
    // screenLayout receives raw navigation params; retain Expo Router's URI decoding.
    const decoded = Object.fromEntries(
      Object.entries(params ?? {}).map(([key, value]) => {
        if (typeof value !== 'string') return [key, value];
        try {
          return [key, decodeURIComponent(value)];
        } catch {
          return [key, value];
        }
      }),
    ) as PlayerParams;
    return { itemId: decoded.itemId, selection: parsePlaybackSelection(decoded) };
  }, [params]);

  return (
    <VideoPlayer key={itemId} itemId={itemId} initialSelection={selection} lifecycle={lifecycle}>
      {children}
    </VideoPlayer>
  );
}
