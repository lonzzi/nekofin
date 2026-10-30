import type { EndEvent } from 'expo-mpv';

export type PlaybackCompletion = { context: object; reason: EndEvent['reason'] };

/** Claim one next-episode navigation per native playback instance. */
export function createPlayerAutoNext() {
  let advancedContext: object | null = null;

  return {
    claim({
      completion,
      activeContext,
      enabled,
      appActive,
      itemId,
      itemType,
      nextEpisodeId,
    }: {
      completion: PlaybackCompletion | null;
      activeContext: object | null;
      enabled: boolean;
      appActive: boolean;
      itemId: string;
      itemType?: string;
      nextEpisodeId?: string | null;
    }) {
      if (
        !enabled ||
        !appActive ||
        completion?.reason !== 'ended' ||
        completion.context !== activeContext ||
        advancedContext === activeContext ||
        itemType !== 'Episode' ||
        !nextEpisodeId ||
        nextEpisodeId === itemId
      )
        return null;

      advancedContext = activeContext;
      return nextEpisodeId;
    },
  };
}
