import { HomeAtmosphereScrollView } from '@/components/home/HomeAtmosphereScrollView';
import { DetailBundle, useDetailBundle } from '@/hooks/useDetailBundle';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import useRefresh from '@/hooks/useRefresh';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from 'expo-router';
import { HeaderButton } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, Text, useWindowDimensions, View } from 'react-native';

import { ItemImage } from '../ItemImage';
import { SkeletonDetailContent, SkeletonDetailHeader } from '../ui/Skeleton';
import { detailViewStyles } from './common';
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
  const navigation = useNavigation();
  const { currentServer } = useMediaServers();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const textColor = theme.colors.text;
  const { title, backgroundImageUrl, setItem, selectedItem } = useDetailView();

  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isWatched, setIsWatched] = useState<boolean>(false);
  const { data: bundle, isLoading, refetch } = query;

  const { width: windowWidth } = useWindowDimensions();
  const headerHeight = useMediaHeroHeight();
  const detailLogoWidth = Math.min(windowWidth * 0.72, 300);

  const mediaAdapter = useMediaAdapter();

  const item = bundle?.item;
  const seasons = bundle?.seasons ?? [];
  const nextUpItems = bundle?.nextUpItems ?? [];
  const episodes = bundle?.episodes ?? [];
  const similarShows = bundle?.similarShows ?? [];
  const similarMovies = bundle?.similarMovies ?? [];

  const { refreshing, onRefresh } = useRefresh(refetch, [itemId]);

  const markCurrentServerMediaStale = useCallback(() => {
    if (!currentServer?.id) return;
    void queryClient.invalidateQueries({
      queryKey: mediaQueryKeys.server(currentServer.id),
      refetchType: 'none',
    });
  }, [currentServer?.id, queryClient]);

  useEffect(() => {
    if (!item) return;
    setItem?.(item);
  }, [item, setItem]);

  useEffect(() => {
    if (mode === 'episode' && selectedItem) {
      setIsFavorite(!!selectedItem.userData?.isFavorite);
      setIsWatched(!!selectedItem.userData?.played);
    } else if (mode !== 'episode' && item) {
      setIsFavorite(!!item.userData?.isFavorite);
      setIsWatched(!!item.userData?.played);
    }
  }, [mode, selectedItem, item]);

  useEffect(() => {
    const currentItem = mode === 'episode' ? selectedItem : item;
    const currentItemId = currentItem?.id;

    navigation.setOptions({
      headerRight: () =>
        currentItemId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
            <HeaderButton
              onPress={async () => {
                if (!currentServer?.userId || !currentItemId) return;
                if (isWatched) {
                  await mediaAdapter.markItemUnplayed({
                    userId: currentServer.userId,
                    itemId: currentItemId,
                  });
                  setIsWatched(false);
                  markCurrentServerMediaStale();
                } else {
                  await mediaAdapter.markItemPlayed({
                    userId: currentServer.userId,
                    itemId: currentItemId,
                  });
                  setIsWatched(true);
                  markCurrentServerMediaStale();
                }
              }}
              style={{ paddingHorizontal: 6 }}
            >
              <Ionicons
                name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={24}
                color={textColor}
              />
            </HeaderButton>
            <HeaderButton
              onPress={async () => {
                if (!currentServer?.userId || !currentItemId) return;
                if (isFavorite) {
                  await mediaAdapter.removeFavoriteItem({
                    userId: currentServer.userId,
                    itemId: currentItemId,
                  });
                  setIsFavorite(false);
                  markCurrentServerMediaStale();
                } else {
                  await mediaAdapter.addFavoriteItem({
                    userId: currentServer.userId,
                    itemId: currentItemId,
                  });
                  setIsFavorite(true);
                  markCurrentServerMediaStale();
                }
              }}
              style={{ paddingHorizontal: 6 }}
            >
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={24} color={textColor} />
            </HeaderButton>
          </View>
        ) : null,
    });
  }, [
    navigation,
    item?.name,
    mode,
    isFavorite,
    isWatched,
    currentServer?.userId,
    item?.id,
    selectedItem?.id,
    textColor,
    mediaAdapter,
    item,
    selectedItem,
    markCurrentServerMediaStale,
  ]);

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
      <HomeAtmosphereScrollView
        backgroundColor={backgroundColor}
        contentStyle={atmosphereContentStyle}
        headerHeight={headerHeight}
        headerImage={<SkeletonDetailHeader />}
        isDark={theme.isDark}
      >
        <SkeletonDetailContent mode={mode} includeTopPadding={false} />
      </HomeAtmosphereScrollView>
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
