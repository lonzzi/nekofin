import { HomeAtmosphereScrollView } from '@/components/home/HomeAtmosphereScrollView';
import { DETAIL_TOOLBAR_STATES } from '@/components/navigation/nativeHeaderModel';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { DetailBundle, useDetailBundle } from '@/hooks/useDetailBundle';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import useRefresh from '@/hooks/useRefresh';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, Text, useWindowDimensions, View } from 'react-native';

import { ItemImage } from '../ItemImage';
import { SkeletonDetailContent, SkeletonDetailHeader } from '../ui/Skeleton';
import { detailViewStyles } from './common';
import {
  resolveDetailToolbarState,
  withDetailToolbarOverride,
  type DetailToolbarOverrides,
} from './detailToolbarState';
import { DetailViewProvider, useDetailView } from './DetailViewContext';
import { EpisodeModeContent } from './episode';
import { MovieModeContent } from './movie';
import { SeriesModeContent } from './series';

const DETAIL_HERO_IMAGE_WIDTH = 1000;
const DETAIL_ATMOSPHERE_IMAGE_WIDTH = 640;

export type DetailViewProps = {
  itemId: string;
  mode: 'series' | 'movie' | 'episode';
  query: UseQueryResult<DetailBundle, Error>;
  seasonId?: string;
};

function DetailViewContent({ itemId, mode, query, seasonId }: DetailViewProps) {
  const { currentServer } = useMediaServers();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const textColor = theme.colors.text;
  const { title, backgroundImageUrl, setItem, selectedItem } = useDetailView();

  const [toolbarOverrides, setToolbarOverrides] = useState<DetailToolbarOverrides>({});
  const [pendingFavoriteItemIds, setPendingFavoriteItemIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pendingWatchedItemIds, setPendingWatchedItemIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const { data: bundle, isLoading, refetch } = query;

  const { width: windowWidth } = useWindowDimensions();
  const headerHeight = useMediaHeroHeight();
  const detailLogoWidth = Math.min(windowWidth * 0.72, 300);

  const mediaAdapter = useMediaAdapter();

  const item = bundle?.item;
  const currentItem = mode === 'episode' ? selectedItem : item;
  const currentItemId = currentItem?.id;
  const { isFavorite, isWatched } = resolveDetailToolbarState({
    itemId: currentItemId,
    itemIsFavorite: !!currentItem?.userData?.isFavorite,
    itemIsWatched: !!currentItem?.userData?.played,
    overrides: toolbarOverrides,
  });
  const isFavoritePending = !!currentItemId && pendingFavoriteItemIds.has(currentItemId);
  const isWatchedPending = !!currentItemId && pendingWatchedItemIds.has(currentItemId);
  const seasons = bundle?.seasons ?? [];
  const nextUpItems = bundle?.nextUpItems ?? [];
  const episodes = bundle?.episodes ?? [];
  const similarShows = bundle?.similarShows ?? [];
  const similarMovies = bundle?.similarMovies ?? [];
  const currentServerId = currentServer?.id;

  const { refreshing, onRefresh } = useRefresh(refetch, [itemId]);

  const markCurrentServerMediaStale = useCallback(() => {
    if (!currentServerId) return;
    void queryClient.invalidateQueries({
      queryKey: mediaQueryKeys.server(currentServerId),
      refetchType: 'none',
    });
  }, [currentServerId, queryClient]);

  useEffect(() => {
    if (!item) return;
    setItem?.(item);
  }, [item, setItem]);

  const handleToggleWatched = useCallback(async () => {
    const actionItemId = currentItemId;
    const userId = currentServer?.userId;
    if (!userId || !actionItemId || pendingWatchedItemIds.has(actionItemId)) return;

    const nextIsWatched = !isWatched;
    setPendingWatchedItemIds((pendingIds) => new Set(pendingIds).add(actionItemId));
    try {
      if (nextIsWatched) {
        await mediaAdapter.markItemPlayed({ userId, itemId: actionItemId });
      } else {
        await mediaAdapter.markItemUnplayed({ userId, itemId: actionItemId });
      }
      setToolbarOverrides((overrides) =>
        withDetailToolbarOverride(overrides, actionItemId, 'watched', nextIsWatched),
      );
      markCurrentServerMediaStale();
    } catch (error) {
      console.error(nextIsWatched ? '标记为已看失败:' : '标记为未看失败:', error);
    } finally {
      setPendingWatchedItemIds((pendingIds) => {
        const nextPendingIds = new Set(pendingIds);
        nextPendingIds.delete(actionItemId);
        return nextPendingIds;
      });
    }
  }, [
    currentItemId,
    currentServer?.userId,
    isWatched,
    markCurrentServerMediaStale,
    mediaAdapter,
    pendingWatchedItemIds,
  ]);

  const handleToggleFavorite = useCallback(async () => {
    const actionItemId = currentItemId;
    const userId = currentServer?.userId;
    if (!userId || !actionItemId || pendingFavoriteItemIds.has(actionItemId)) return;

    const nextIsFavorite = !isFavorite;
    setPendingFavoriteItemIds((pendingIds) => new Set(pendingIds).add(actionItemId));
    try {
      if (nextIsFavorite) {
        await mediaAdapter.addFavoriteItem({ userId, itemId: actionItemId });
      } else {
        await mediaAdapter.removeFavoriteItem({ userId, itemId: actionItemId });
      }
      setToolbarOverrides((overrides) =>
        withDetailToolbarOverride(overrides, actionItemId, 'favorite', nextIsFavorite),
      );
      markCurrentServerMediaStale();
    } catch (error) {
      console.error(nextIsFavorite ? '添加收藏失败:' : '取消收藏失败:', error);
    } finally {
      setPendingFavoriteItemIds((pendingIds) => {
        const nextPendingIds = new Set(pendingIds);
        nextPendingIds.delete(actionItemId);
        return nextPendingIds;
      });
    }
  }, [
    currentItemId,
    currentServer?.userId,
    isFavorite,
    markCurrentServerMediaStale,
    mediaAdapter,
    pendingFavoriteItemIds,
  ]);

  const watchedPresentation = DETAIL_TOOLBAR_STATES.watched[isWatched ? 'on' : 'off'];
  const favoritePresentation = DETAIL_TOOLBAR_STATES.favorite[isFavorite ? 'on' : 'off'];
  const toolbar = (
    <Stack.Toolbar placement="right">
      {currentItemId ? (
        <Stack.Toolbar.Button
          accessibilityLabel={watchedPresentation.label}
          disabled={isWatchedPending}
          icon={getNativeToolbarIcon(
            watchedPresentation.androidDrawable,
            watchedPresentation.iosIcon,
          )}
          onPress={() => void handleToggleWatched()}
          selected={isWatched}
          tintColor={textColor}
        >
          {watchedPresentation.label}
        </Stack.Toolbar.Button>
      ) : null}
      {currentItemId ? (
        <Stack.Toolbar.Button
          accessibilityLabel={favoritePresentation.label}
          disabled={isFavoritePending}
          icon={getNativeToolbarIcon(
            favoritePresentation.androidDrawable,
            favoritePresentation.iosIcon,
          )}
          onPress={() => void handleToggleFavorite()}
          selected={isFavorite}
          tintColor={textColor}
        >
          {favoritePresentation.label}
        </Stack.Toolbar.Button>
      ) : null}
    </Stack.Toolbar>
  );

  const atmosphereContentStyle = {
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  };

  const logoImageUrl = useMemo(() => {
    if (!item) return undefined;
    return mediaAdapter.getImageInfo({ item, opts: { preferLogo: true, width: 400 } }).url;
  }, [item, mediaAdapter]);
  const logoImageSource = useMemo(
    () => (logoImageUrl ? { uri: logoImageUrl } : undefined),
    [logoImageUrl],
  );

  if (isLoading || !item) {
    return (
      <>
        {toolbar}
        <HomeAtmosphereScrollView
          backgroundColor={backgroundColor}
          contentStyle={atmosphereContentStyle}
          headerHeight={headerHeight}
          headerImage={<SkeletonDetailHeader />}
          isDark={theme.isDark}
        >
          <SkeletonDetailContent mode={mode} includeTopPadding={false} />
        </HomeAtmosphereScrollView>
      </>
    );
  }

  const headerImageInfo = mediaAdapter.getImageInfo({
    item,
    opts: { preferBackdrop: true, width: DETAIL_HERO_IMAGE_WIDTH },
  });
  const atmosphereImageInfo = mediaAdapter.getImageInfo({
    item,
    opts: { preferBackdrop: true, width: DETAIL_ATMOSPHERE_IMAGE_WIDTH },
  });
  const headerImageUrl = backgroundImageUrl || headerImageInfo.url;
  const atmosphereImageUrl = backgroundImageUrl || atmosphereImageInfo.url || headerImageUrl;

  const renderModeContent = () => {
    const modeComponents = {
      series: (
        <SeriesModeContent
          seasons={seasons}
          nextUpItems={nextUpItems}
          people={(item?.people ?? []).slice(0, 20)}
          similarItems={similarShows}
          item={item}
        />
      ),
      movie: (
        <MovieModeContent
          people={(item?.people ?? []).slice(0, 20)}
          similarItems={similarMovies}
          item={item}
        />
      ),
      episode: (
        <EpisodeModeContent
          seasons={seasons}
          episodes={episodes}
          item={item}
          people={(item?.people ?? []).slice(0, 20)}
          similarItems={similarMovies}
          seasonId={seasonId}
        />
      ),
    };

    return modeComponents[mode];
  };

  return (
    <>
      {toolbar}
      <HomeAtmosphereScrollView
        backgroundColor={backgroundColor}
        contentStyle={atmosphereContentStyle}
        headerHeight={headerHeight}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        imageInfo={{
          blurhash: atmosphereImageInfo.blurhash ?? headerImageInfo.blurhash,
          imageUrl: atmosphereImageUrl,
        }}
        isDark={theme.isDark}
        headerImage={
          <View style={[detailViewStyles.header, { backgroundColor: theme.colors.surfaceMuted }]}>
            {headerImageUrl && (
              <ItemImage
                uri={headerImageUrl}
                style={detailViewStyles.headerMedia}
                placeholderBlurhash={headerImageInfo.blurhash}
                contentFit="cover"
              />
            )}
            {!!logoImageUrl && (
              <LinearGradient
                colors={[theme.colors.mediaScrimSoft, 'rgba(0,0,0,0.16)', theme.colors.mediaScrim]}
                locations={[0, 0.52, 1]}
                pointerEvents="none"
                style={detailViewStyles.headerScrim}
              />
            )}
          </View>
        }
        headerOverlay={
          logoImageUrl ? (
            <Image
              source={logoImageSource}
              style={[
                detailViewStyles.headerLogo,
                {
                  bottom: theme.spacing.xxxl,
                  left: (windowWidth - detailLogoWidth) / 2,
                  width: detailLogoWidth,
                },
              ]}
              cachePolicy="memory-disk"
              contentFit="contain"
              recyclingKey={logoImageUrl}
            />
          ) : null
        }
      >
        <View style={detailViewStyles.content}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: textColor }}>
            {title || item.name}
          </Text>
          {renderModeContent()}
        </View>
      </HomeAtmosphereScrollView>
    </>
  );
}

export default function DetailView({ itemId, mode, ...rest }: Omit<DetailViewProps, 'query'>) {
  const query = useDetailBundle(mode, itemId);
  const detailViewKey = `${mode}:${itemId}:${rest.seasonId ?? ''}`;

  return (
    <DetailViewProvider key={detailViewKey} itemId={itemId} mode={mode} query={query} {...rest}>
      <DetailViewContent itemId={itemId} mode={mode} query={query} {...rest} />
    </DetailViewProvider>
  );
}
