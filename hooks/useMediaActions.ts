import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { updateCachedMediaItemUserData } from '@/services/media/cache';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { MediaItem, MediaServerInfo, MediaUserData } from '@/services/media/types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

export function useMediaActions(item: MediaItem, serverOverride?: MediaServerInfo) {
  const router = useTracedRouter('media-actions');
  const queryClient = useQueryClient();
  const { currentServer, setCurrentServer } = useMediaServers();
  const currentMediaAdapter = useMediaAdapter();
  const targetServer = serverOverride ?? currentServer;
  const mediaAdapter = useMemo(() => {
    if (!serverOverride) return currentMediaAdapter;

    const api = createMediaApiFromServerInfo(serverOverride);
    return createMediaAdapterWithApi(serverOverride.type, api);
  }, [currentMediaAdapter, serverOverride]);

  const [localUserData, setLocalUserData] = useState<MediaUserData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setLocalUserData(item.userData || null);
    setIsUpdating(false);
  }, [item.id, item.userData]);

  const currentUserData = localUserData || item.userData;

  const updateCachedUserData = (
    updater: (previous: MediaUserData | null | undefined) => MediaUserData | null,
  ) => {
    if (!targetServer?.id || !item.id) return;
    queryClient.setQueriesData(
      { queryKey: mediaQueryKeys.server(targetServer.id) },
      (data: unknown) => updateCachedMediaItemUserData(data, item.id, updater),
    );
  };

  const invalidateServerMedia = () => {
    if (!targetServer?.id) return;
    void queryClient.invalidateQueries({
      queryKey: mediaQueryKeys.server(targetServer.id),
    });
  };

  const handlePlay = () => {
    if (!item.id) return;
    if (serverOverride && serverOverride.id !== currentServer?.id) {
      setCurrentServer(serverOverride);
    }
    router.push({
      pathname: '/player',
      params: { itemId: item.id },
    });
  };

  // Shared optimistic-update flow: snapshot → apply patch to local + cache →
  // call the adapter and invalidate on success, rolling back on failure.
  const runOptimisticUpdate = async (
    patch: Partial<MediaUserData>,
    apiCall: (ctx: { userId: string; itemId: string }) => Promise<unknown>,
    errorLabel: string,
  ) => {
    if (!item.id || !targetServer || isUpdating) return;

    const previousUserData = currentUserData ?? null;
    setIsUpdating(true);
    setLocalUserData({ ...previousUserData, ...patch });
    updateCachedUserData((prev) => ({ ...prev, ...patch }));

    try {
      await apiCall({ userId: targetServer.userId, itemId: item.id });
      invalidateServerMedia();
    } catch (error) {
      setLocalUserData(previousUserData);
      updateCachedUserData(() => previousUserData);
      console.error(errorLabel, error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddToFavorites = () =>
    runOptimisticUpdate(
      { isFavorite: true },
      (ctx) => mediaAdapter.addFavoriteItem(ctx),
      '添加收藏失败:',
    );

  const handleMarkAsWatched = () =>
    runOptimisticUpdate(
      { played: true, playedPercentage: 100 },
      (ctx) => mediaAdapter.markItemPlayed({ ...ctx, datePlayed: new Date().toISOString() }),
      '标记为已看失败:',
    );

  const handleMarkAsUnwatched = () =>
    runOptimisticUpdate(
      { played: false, playedPercentage: 0 },
      (ctx) => mediaAdapter.markItemUnplayed(ctx),
      '标记为未看失败:',
    );

  return {
    currentUserData,
    isUpdating,
    handlePlay,
    handleAddToFavorites,
    handleMarkAsWatched,
    handleMarkAsUnwatched,
  };
}
