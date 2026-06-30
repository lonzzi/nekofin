import ParallaxScrollView from '@/components/ParallaxScrollView';
import { DetailBundle, useDetailBundle } from '@/hooks/useDetailBundle';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import useRefresh from '@/hooks/useRefresh';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from 'expo-router';
import { HeaderButton } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemImage } from '../ItemImage';
import { SkeletonDetailContent, SkeletonDetailHeader } from '../ui/Skeleton';
import { detailViewStyles } from './common';
import { DetailViewProvider, useDetailView } from './DetailViewContext';
import { EpisodeModeContent } from './episode';
import { MovieModeContent } from './movie';
import { SeriesModeContent } from './series';

export type DetailViewProps = {
  itemId: string;
  mode: 'series' | 'movie' | 'episode';
  query: UseQueryResult<DetailBundle, Error>;
  seasonId?: string;
};

function DetailViewContent({ itemId, mode, query, seasonId }: DetailViewProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentServer } = useMediaServers();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const textColor = theme.colors.text;
  const { title, backgroundImageUrl, setItem, selectedItem } = useDetailView();

  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isWatched, setIsWatched] = useState<boolean>(false);
  const { data: bundle, isLoading, refetch } = query;

  const { width: windowWidth } = useWindowDimensions();
  const headerHeight = useMediaHeroHeight();
  const bottomScrollInset = insets.bottom + theme.spacing.xxl + theme.spacing.xl;
  const detailLogoWidth = Math.min(windowWidth * 0.72, 300);

  const mediaAdapter = useMediaAdapter();

  const item = bundle?.item;
  const seasons = bundle?.seasons ?? [];
  const nextUpItems = bundle?.nextUpItems ?? [];
  const episodes = bundle?.episodes ?? [];
  const similarShows = bundle?.similarShows ?? [];
  const similarMovies = bundle?.similarMovies ?? [];

  const { refreshing, onRefresh } = useRefresh(refetch, [itemId]);

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
                } else {
                  await mediaAdapter.markItemPlayed({
                    userId: currentServer.userId,
                    itemId: currentItemId,
                  });
                  setIsWatched(true);
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
                } else {
                  await mediaAdapter.addFavoriteItem({
                    userId: currentServer.userId,
                    itemId: currentItemId,
                  });
                  setIsFavorite(true);
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
  ]);

  if (isLoading || !item) {
    return (
      <View style={[detailViewStyles.container, { backgroundColor }]}>
        <SkeletonDetailHeader />
        <SkeletonDetailContent mode={mode} />
      </View>
    );
  }

  const headerImageInfo = mediaAdapter.getImageInfo({
    item,
    opts: { preferBackdrop: true, width: 1200 },
  });
  const headerImageUrl = backgroundImageUrl || headerImageInfo.url;

  const logoImageInfo = mediaAdapter.getImageInfo({ item, opts: { preferLogo: true, width: 400 } });
  const logoImageUrl = logoImageInfo.url;

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
    <ParallaxScrollView
      headerHeight={headerHeight}
      showsVerticalScrollIndicator={false}
      contentInset={{ bottom: bottomScrollInset }}
      scrollIndicatorInsets={{ bottom: bottomScrollInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      headerBackgroundColor={{
        light: theme.colors.surfaceMuted,
        dark: theme.colors.surfaceMuted,
      }}
      contentStyle={{
        paddingBottom: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        backgroundColor,
      }}
      style={{ backgroundColor }}
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
            <>
              <LinearGradient
                colors={[theme.colors.mediaScrimSoft, 'rgba(0,0,0,0.16)', theme.colors.mediaScrim]}
                locations={[0, 0.52, 1]}
                pointerEvents="none"
                style={detailViewStyles.headerScrim}
              />
              <Image
                source={{ uri: logoImageUrl }}
                style={[
                  detailViewStyles.headerLogo,
                  {
                    bottom: theme.spacing.xxxl,
                    left: (windowWidth - detailLogoWidth) / 2,
                    width: detailLogoWidth,
                  },
                ]}
                contentFit="contain"
              />
            </>
          )}
        </View>
      }
    >
      <View style={detailViewStyles.content}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: textColor }}>
          {title || item.name}
        </Text>
        {renderModeContent()}
      </View>
    </ParallaxScrollView>
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
