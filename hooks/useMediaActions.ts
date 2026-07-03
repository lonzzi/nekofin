import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { updateCachedMediaItemUserData } from '@/services/media/cache';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { MediaItem, MediaUserData } from '@/services/media/types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useMediaActions(item: MediaItem) {
  const router = useTracedRouter('media-actions');
  const queryClient = useQueryClient();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

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
    if (!currentServer?.id || !item.id) return;
    queryClient.setQueriesData(
      { queryKey: mediaQueryKeys.server(currentServer.id) },
      (data: unknown) => updateCachedMediaItemUserData(data, item.id, updater),
    );
  };

  const invalidateServerMedia = () => {
    if (!currentServer?.id) return;
    void queryClient.invalidateQueries({
      queryKey: mediaQueryKeys.server(currentServer.id),
    });
  };

  const handlePlay = () => {
    if (!item.id) return;
    router.push({
      pathname: '/player',
      params: { itemId: item.id },
    });
  };

  const handleAddToFavorites = async () => {
    if (!item.id || !currentServer || isUpdating) return;

    const previousUserData = currentUserData ?? null;
    setIsUpdating(true);
    const nextUserData = {
      ...previousUserData,
      isFavorite: true,
    };
    setLocalUserData(nextUserData);
    updateCachedUserData((prev) => ({
      ...prev,
      isFavorite: true,
    }));

    try {
      await mediaAdapter.addFavoriteItem({
        userId: currentServer.userId,
        itemId: item.id,
      });
      invalidateServerMedia();
    } catch (error) {
      setLocalUserData(previousUserData);
      updateCachedUserData(() => previousUserData);
      console.error('添加收藏失败:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsWatched = async () => {
    if (!item.id || !currentServer || isUpdating) return;

    const previousUserData = currentUserData ?? null;
    setIsUpdating(true);
    const nextUserData = {
      ...previousUserData,
      played: true,
      playedPercentage: 100,
    };
    setLocalUserData(nextUserData);
    updateCachedUserData((prev) => ({
      ...prev,
      played: true,
      playedPercentage: 100,
    }));

    try {
      await mediaAdapter.markItemPlayed({
        userId: currentServer.userId,
        itemId: item.id,
        datePlayed: new Date().toISOString(),
      });
      invalidateServerMedia();
    } catch (error) {
      setLocalUserData(previousUserData);
      updateCachedUserData(() => previousUserData);
      console.error('标记为已看失败:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsUnwatched = async () => {
    if (!item.id || !currentServer || isUpdating) return;

    const previousUserData = currentUserData ?? null;
    setIsUpdating(true);
    const nextUserData = {
      ...previousUserData,
      played: false,
      playedPercentage: 0,
    };
    setLocalUserData(nextUserData);
    updateCachedUserData((prev) => ({
      ...prev,
      played: false,
      playedPercentage: 0,
    }));

    try {
      await mediaAdapter.markItemUnplayed({
        userId: currentServer.userId,
        itemId: item.id,
      });
      invalidateServerMedia();
    } catch (error) {
      setLocalUserData(previousUserData);
      updateCachedUserData(() => previousUserData);
      console.error('标记为未看失败:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    currentUserData,
    isUpdating,
    handlePlay,
    handleAddToFavorites,
    handleMarkAsWatched,
    handleMarkAsUnwatched,
  };
}
