import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { deriveExternalSubtitles, prioritizeSubtitleTracks } from '@/services/media/externalTracks';
import { createExternalSubtitleCache } from '@/services/media/subtitleCache';
import type { MediaSource } from '@/services/media/types';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect } from 'react';

/** Warm only the displayed item's selected version; playback shares the same in-flight work. */
export function useSubtitlePrefetch(
  itemId: string,
  source: MediaSource | undefined,
  preferredIndex?: number,
) {
  const { currentServer, currentApi } = useMediaServers();
  const serverId = currentServer?.id;
  const userId = currentServer?.userId;
  const basePath = currentApi?.basePath;
  const accessToken = currentApi?.accessToken;
  const focused = useIsFocused();
  const pathname = usePathname();
  const { itemId: playerItemId } = useGlobalSearchParams<{ itemId?: string }>();
  // Keep in-flight work during handoff to this item's player, but stop warming
  // old detail screens when browsing another item or switching tabs.
  const enabled =
    focused ||
    ((pathname === '/player' || pathname.startsWith('/player/')) && playerItemId === itemId);
  useEffect(() => {
    if (!enabled || !serverId || !userId || !source || !basePath) return;
    const tracks = deriveExternalSubtitles(
      source.mediaStreams.map((stream) => ({
        Type: stream.type,
        Index: stream.index,
        DisplayTitle: stream.displayTitle,
        Language: stream.language,
        Codec: stream.codec,
        IsExternal: stream.isExternal,
        DeliveryMethod: stream.deliveryMethod,
        DeliveryUrl: stream.deliveryUrl,
      })),
      basePath,
      { itemId, mediaSourceId: source.id, accessToken },
    );
    if (!tracks.length) return;
    // Download the selected subtitle first. A failing optional track must not stop the rest.
    const cache = createExternalSubtitleCache({
      serverId,
      userId,
      itemId,
      mediaSourceId: source.id,
      sourceSize: source.size,
    });
    let active = true;
    void (async () => {
      try {
        for (const track of prioritizeSubtitleTracks(tracks, preferredIndex)) {
          if (!active) break;
          await cache.prepare(track, () => active).catch(() => {});
        }
      } finally {
        cache.dispose();
      }
    })();
    return () => {
      active = false;
      cache.dispose();
    };
  }, [enabled, serverId, userId, itemId, source, preferredIndex, basePath, accessToken]);
}
