import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { deriveExternalSubtitles } from '@/services/media/externalTracks';
import { createExternalSubtitleCache } from '@/services/media/subtitleCache';
import type { MediaSource } from '@/services/media/types';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect } from 'react';

import { useSubtitleFonts } from './useSubtitleFonts';

/** Warm the selected subtitle; playback shares the same file and in-flight work. */
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
  useSubtitleFonts(itemId, source, enabled);
  useEffect(() => {
    if (
      !enabled ||
      !serverId ||
      !userId ||
      !source ||
      !basePath ||
      preferredIndex == null ||
      preferredIndex < 0
    )
      return;
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
    const track = tracks.find((entry) => entry.index === preferredIndex);
    if (!track) return;
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
        await cache.prepare(track, () => active).catch(() => {});
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
