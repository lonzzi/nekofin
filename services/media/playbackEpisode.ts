import type { QueryClient } from '@tanstack/react-query';

import { mediaQueryKeys } from './queryKeys';
import type { MediaItem, MediaServerInfo } from './types';

export type PlaybackEpisode = {
  item: MediaItem;
  playSessionId: string;
};

/** Keep the last played episode locally even before the server acknowledges stopping. */
export function rememberPlaybackEpisode({
  client,
  server,
  item,
  playSessionId,
  positionMs,
  started = false,
}: {
  client: QueryClient;
  server: MediaServerInfo;
  item: MediaItem;
  playSessionId: string;
  positionMs: number;
  started?: boolean;
}) {
  if (item.type !== 'Episode' || !item.seriesId || !server.userId) return;
  const key = mediaQueryKeys.playbackEpisode(server.id, server.userId, item.seriesId);
  client.setQueryData<PlaybackEpisode>(key, (previous) => {
    // An outgoing episode can stop after the next episode has already started.
    if (!started && (previous?.playSessionId !== playSessionId || previous.item.id !== item.id)) {
      return previous;
    }
    const positionTicks = Math.round(
      Math.max(0, Number.isFinite(positionMs) ? positionMs : 0) * 10_000,
    );
    return {
      playSessionId,
      item: {
        ...item,
        userData: {
          ...item.userData,
          playbackPositionTicks: positionTicks,
          ...(item.runTimeTicks && item.runTimeTicks > 0
            ? { playedPercentage: Math.min(100, (positionTicks / item.runTimeTicks) * 100) }
            : {}),
        },
      },
    };
  });
}
