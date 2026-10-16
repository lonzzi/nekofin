import { HomeAtmosphereScrollView } from '@/components/home/HomeAtmosphereScrollView';
import {
  HeaderButton,
  HeaderMenu,
  HeaderMenuAction,
  HeaderToolbar,
} from '@/components/navigation/HeaderToolbar';
import { DETAIL_TOOLBAR_STATES } from '@/components/navigation/nativeHeaderModel';
import {
  DETAIL_MORE_MENU_ICONS,
  getNativeToolbarIcon,
} from '@/components/navigation/nativeToolbarIcons';
import { DetailBundle, useDetailBundle } from '@/hooks/useDetailBundle';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import useRefresh from '@/hooks/useRefresh';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { itemDetailQueryOptions } from '@/services/media/queryOptions';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ItemImage } from '../ItemImage';
import { SkeletonDetailContent, SkeletonDetailHeader } from '../ui/Skeleton';
import { detailViewStyles } from './common';
import { getDetailExternalInfo } from './detailExternalLinks';
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
  const { data: bundle, isLoading, refetch } = query;

  const window = useWindowDimensions();
  const tablet = Platform.OS === 'ios' && Platform.isPad;
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const windowWidth = tablet ? viewport.width : window.width;
  const phoneHeaderHeight = useMediaHeroHeight();
  const headerHeight = tablet
    ? Math.round(Math.max(260, Math.min(viewport.width * 0.5625, viewport.height * 0.52)))
    : phoneHeaderHeight;
  const detailLogoWidth = Math.min(windowWidth * 0.72, 300);

  const mediaAdapter = useMediaAdapter();

  const item = bundle?.item;
  const currentItem = mode === 'episode' ? selectedItem : item;
  const currentItemId = currentItem?.id;
  const parentSeriesId =
    currentItem?.type === 'Episode' || currentItem?.type === 'Season'
      ? currentItem.seriesId || (currentItem.type === 'Season' ? currentItem.parentId : undefined)
      : undefined;
  const seriesQuery = useQuery({
    ...itemDetailQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      itemId: parentSeriesId,
    }),
    staleTime: 10 * 60 * 1000,
  });
  const externalInfo = useMemo(
    () => (currentItem ? getDetailExternalInfo(currentItem, seriesQuery.data) : undefined),
    [currentItem, seriesQuery.data],
  );
  const { isFavorite } = resolveDetailToolbarState({
    itemId: currentItemId,
    itemIsFavorite: !!currentItem?.userData?.isFavorite,
    itemIsWatched: !!currentItem?.userData?.played,
    overrides: toolbarOverrides,
  });
  const isFavoritePending = !!currentItemId && pendingFavoriteItemIds.has(currentItemId);
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

  const favoritePresentation = DETAIL_TOOLBAR_STATES.favorite[isFavorite ? 'on' : 'off'];
  const handleOpenExternalLink = useCallback(
    async (url: string) => {
      try {
        await openBrowserAsync(url, { controlsColor: theme.colors.tint });
      } catch {
        Alert.alert('无法打开页面', '请稍后重试');
      }
    },
    [theme.colors.tint],
  );
  const handleShare = useCallback(async () => {
    if (!externalInfo) return;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: externalInfo.title, url: externalInfo.shareUrl }
          : {
              title: externalInfo.title,
              message: `${externalInfo.title}\n${externalInfo.shareUrl}`,
            },
        { subject: externalInfo.title, dialogTitle: '分享影片信息', tintColor: theme.colors.tint },
      );
    } catch {
      Alert.alert('无法分享', '请稍后重试');
    }
  }, [externalInfo, theme.colors.tint]);
  const toolbar = (
    <HeaderToolbar key={currentItemId ?? 'loading'} placement="right">
      {currentItemId ? (
        <HeaderButton
          accessibilityLabel={favoritePresentation.label}
          disabled={isFavoritePending}
          icon={getNativeToolbarIcon(
            favoritePresentation.androidDrawable,
            favoritePresentation.iosIcon,
          )}
          onPress={() => void handleToggleFavorite()}
          tintColor={Platform.OS === 'ios' && isFavorite ? theme.colors.danger : textColor}
        >
          {favoritePresentation.label}
        </HeaderButton>
      ) : null}
      {externalInfo ? (
        <HeaderMenu
          accessibilityLabel="更多影片操作"
          icon={DETAIL_MORE_MENU_ICONS.more}
          tintColor={textColor}
        >
          <HeaderMenu inline>
            {externalInfo.links.map((link) => (
              <HeaderMenuAction
                key={link.provider}
                icon={DETAIL_MORE_MENU_ICONS.external}
                onPress={() => void handleOpenExternalLink(link.url)}
              >
                {link.label}
              </HeaderMenuAction>
            ))}
          </HeaderMenu>
          <HeaderMenuAction icon={DETAIL_MORE_MENU_ICONS.share} onPress={() => void handleShare()}>
            分享影片信息
          </HeaderMenuAction>
        </HeaderMenu>
      ) : null}
    </HeaderToolbar>
  );

  const atmosphereContentStyle = {
    paddingBottom: theme.spacing.lg,
    paddingTop: tablet ? 0 : theme.spacing.lg,
    marginTop: tablet ? -80 : 0,
  };

  const logoImageUrl = useMemo(() => {
    if (!item) return undefined;
    return mediaAdapter.getImageInfo({ item, opts: { preferLogo: true, width: 400 } }).url;
  }, [item, mediaAdapter]);

  if (isLoading || !item) {
    return (
      <View style={{ flex: 1 }}>
        {toolbar}
        <HomeAtmosphereScrollView
          onLayout={({ nativeEvent }) => setViewport(nativeEvent.layout)}
          backgroundColor={backgroundColor}
          contentStyle={atmosphereContentStyle}
          headerHeight={headerHeight}
          headerImage={<SkeletonDetailHeader />}
          isDark={theme.isDark}
        >
          <SkeletonDetailContent mode={mode} includeTopPadding={false} />
        </HomeAtmosphereScrollView>
      </View>
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
    <View style={{ flex: 1 }}>
      {toolbar}
      <HomeAtmosphereScrollView
        onLayout={({ nativeEvent }) => setViewport(nativeEvent.layout)}
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
            <ItemImage
              uri={headerImageUrl}
              style={detailViewStyles.headerMedia}
              placeholderBlurhash={headerImageInfo.blurhash}
              contentFit="cover"
            />
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
          !tablet && logoImageUrl ? (
            <ItemImage
              uri={logoImageUrl}
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
              fallback={
                <Text
                  numberOfLines={2}
                  style={[
                    theme.typography.title2,
                    { color: theme.colors.inverseText, textAlign: 'center' },
                  ]}
                >
                  {title || item.name}
                </Text>
              }
            />
          ) : null
        }
      >
        <View style={detailViewStyles.content}>{renderModeContent()}</View>
      </HomeAtmosphereScrollView>
    </View>
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
