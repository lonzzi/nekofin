import { ItemImage } from '@/components/ItemImage';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

interface CarouselHeaderProps {
  items: MediaItem[];
  height: number;
  isFocused: boolean;
  showLogo?: boolean;
}

type CarouselImageInfo = {
  imageUrl?: string;
  blurhash?: string;
  logoImageUrl?: string;
};

type CarouselPage = {
  item: MediaItem;
  logicalIndex: number;
  key: string;
};

function getCarouselItemKey(item: MediaItem, index: number) {
  return item.id ?? `${item.type}-${item.seriesId ?? index}`;
}

function getCarouselItemTitle(item: MediaItem) {
  return item.seriesName || item.name || '未知标题';
}

function buildCarouselPages(items: MediaItem[]): CarouselPage[] {
  if (items.length <= 1) {
    return items.map((item, logicalIndex) => ({
      item,
      logicalIndex,
      key: `page-${getCarouselItemKey(item, logicalIndex)}`,
    }));
  }

  const lastIndex = items.length - 1;
  return [
    {
      item: items[lastIndex],
      logicalIndex: lastIndex,
      key: `clone-start-${getCarouselItemKey(items[lastIndex], lastIndex)}`,
    },
    ...items.map((item, logicalIndex) => ({
      item,
      logicalIndex,
      key: `page-${getCarouselItemKey(item, logicalIndex)}`,
    })),
    {
      item: items[0],
      logicalIndex: 0,
      key: `clone-end-${getCarouselItemKey(items[0], 0)}`,
    },
  ];
}

function getLogicalIndexForPage(page: number, itemCount: number) {
  if (itemCount <= 1) return 0;
  if (page === 0) return itemCount - 1;
  if (page === itemCount + 1) return 0;
  return Math.min(Math.max(page - 1, 0), itemCount - 1);
}

type CarouselSlideProps = {
  imageInfo?: CarouselImageInfo;
  item: MediaItem;
  cardWidth: number;
  cardHeight: number;
  onPress: (item: MediaItem) => void;
};

function CarouselSlide({ imageInfo, item, cardWidth, cardHeight, onPress }: CarouselSlideProps) {
  const theme = useAppTheme();
  const title = getCarouselItemTitle(item);

  return (
    <View style={{ width: cardWidth, height: cardHeight }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开 ${title}`}
        style={styles.carouselCard}
        onPress={() => onPress(item)}
      >
        {imageInfo?.imageUrl ? (
          <ItemImage
            uri={imageInfo.imageUrl}
            style={[styles.carouselImage, { backgroundColor: theme.colors.background }]}
            contentFit="cover"
            contentPosition="left center"
            cachePolicy="memory-disk"
            placeholderBlurhash={imageInfo.blurhash}
          />
        ) : (
          <View
            style={[
              styles.carouselImage,
              styles.carouselPlaceholder,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <IconSymbol name="video.fill" size={48} color={theme.colors.inverseText} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

type CarouselOverlayProps = {
  activeIndex: number;
  imageInfo?: CarouselImageInfo;
  item: MediaItem;
  items: MediaItem[];
  showLogo: boolean;
};

function CarouselOverlay({ activeIndex, imageInfo, item, items, showLogo }: CarouselOverlayProps) {
  const theme = useAppTheme();
  const title = getCarouselItemTitle(item);
  const logoUrl = showLogo ? imageInfo?.logoImageUrl : undefined;

  return (
    <>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        locations={[0.42, 1]}
        style={styles.gradientScrim}
        pointerEvents="none"
      />

      <View pointerEvents="none" style={styles.bottomOverlay}>
        <View style={styles.cardInner}>
          <View style={styles.titleBounds}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.cardLogo} contentFit="contain" />
            ) : (
              <ThemedText
                style={[
                  theme.typography.title3,
                  styles.cardTitle,
                  { color: theme.colors.inverseText },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </ThemedText>
            )}
          </View>

          <View style={styles.cardMetaRow}>
            {item.type === 'Movie' && (
              <View style={styles.cardTag}>
                <ThemedText
                  style={[
                    theme.typography.caption,
                    styles.cardTagText,
                    { color: theme.colors.inverseText },
                  ]}
                >
                  电影
                </ThemedText>
              </View>
            )}
            {item.type === 'Series' && (
              <View style={styles.cardTag}>
                <ThemedText
                  style={[
                    theme.typography.caption,
                    styles.cardTagText,
                    { color: theme.colors.inverseText },
                  ]}
                >
                  剧集
                </ThemedText>
              </View>
            )}
            {!!item.productionYear && (
              <ThemedText style={[theme.typography.footnote, styles.cardMeta]}>
                {item.productionYear}
              </ThemedText>
            )}
            {item.communityRating != null && (
              <ThemedText style={[theme.typography.footnote, styles.cardMeta]}>
                ★ {item.communityRating.toFixed(1)}
              </ThemedText>
            )}
            {!!item.officialRating && (
              <View style={[styles.cardTag, styles.cardTagOutline]}>
                <ThemedText
                  style={[
                    theme.typography.caption,
                    styles.cardTagText,
                    { color: theme.colors.inverseText },
                  ]}
                >
                  {item.officialRating}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        {items.length > 1 && (
          <View style={styles.dotsRow}>
            {items.map((carouselItem, index) => (
              <View
                key={getCarouselItemKey(carouselItem, index)}
                style={[
                  styles.dot,
                  index === activeIndex && styles.dotActive,
                  {
                    backgroundColor:
                      index === activeIndex ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.38)',
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </>
  );
}

export function CarouselHeader({
  items,
  height,
  isFocused,
  showLogo = false,
}: CarouselHeaderProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const listRef = useRef<FlatList<CarouselPage>>(null);
  const currentPageRef = useRef(items.length > 1 ? 1 : 0);
  const router = useRouter();
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const hasImages = items.length > 0;
  const isLooping = items.length > 1;
  const cardWidth = Math.max(viewportWidth, 1);
  const cardHeight = Math.max(height, 1);
  const pageStep = cardWidth;

  const itemIdentity = useMemo(() => items.map(getCarouselItemKey).join('|'), [items]);

  const carouselImageInfos = useMemo(() => {
    return items.map((item) => {
      const imageInfo = mediaAdapter.getImageInfo({
        item,
        opts: {
          preferBackdrop: true,
          preferThumb: true,
          width: 1200,
        },
      });
      const logoImageInfo = showLogo
        ? mediaAdapter.getImageInfo({
            item,
            opts: { preferLogo: true, width: 400 },
          })
        : null;
      return {
        imageUrl: imageInfo.url,
        blurhash: imageInfo.blurhash,
        logoImageUrl: logoImageInfo?.url?.replace('Primary', 'Logo'),
      };
    });
  }, [items, mediaAdapter, showLogo]);

  const pages = useMemo(() => buildCarouselPages(items), [items]);

  const updateDisplayedPage = useCallback(
    (page: number) => {
      const nextIndex = getLogicalIndexForPage(page, items.length);
      setCarouselIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
    },
    [items.length],
  );

  const handleCarouselItemPress = useCallback(
    (item: MediaItem) => {
      if (!item?.id) return;

      switch (item.type) {
        case 'Movie':
          router.push({ pathname: '/movie/[id]', params: { id: item.id } });
          return;
        case 'Series':
          router.push({ pathname: '/series/[id]', params: { id: item.id } });
          return;
        case 'Season':
          router.push({
            pathname: '/episode',
            params: { seasonId: item.id },
          });
          return;
        case 'Episode':
          router.push({
            pathname: '/episode',
            params: { episodeId: item.id, seasonId: item.seasonId },
          });
          return;
        default:
          if (item.seriesId) {
            router.push({ pathname: '/series/[id]', params: { id: item.seriesId } });
          }
      }
    },
    [router],
  );

  const jumpToPage = useCallback(
    (page: number) => {
      currentPageRef.current = page;
      updateDisplayedPage(page);
      listRef.current?.scrollToOffset({
        offset: page * pageStep,
        animated: false,
      });
    },
    [pageStep, updateDisplayedPage],
  );

  const settlePage = useCallback(
    (offsetX: number) => {
      const page = Math.round(offsetX / pageStep);
      currentPageRef.current = page;
      updateDisplayedPage(page);

      if (!isLooping) return;
      if (page === 0) {
        requestAnimationFrame(() => jumpToPage(items.length));
        return;
      }
      if (page === items.length + 1) {
        requestAnimationFrame(() => jumpToPage(1));
      }
    },
    [isLooping, items.length, jumpToPage, pageStep, updateDisplayedPage],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateDisplayedPage(Math.round(event.nativeEvent.contentOffset.x / pageStep));
    },
    [pageStep, updateDisplayedPage],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      settlePage(event.nativeEvent.contentOffset.x);
    },
    [settlePage],
  );

  useEffect(() => {
    if (!isFocused || items.length <= 1) return;
    const timer = setInterval(() => {
      const nextPage = currentPageRef.current + 1;
      currentPageRef.current = nextPage;
      listRef.current?.scrollToOffset({
        offset: nextPage * pageStep,
        animated: true,
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [isFocused, items.length, pageStep]);

  useEffect(() => {
    if (items.length === 0) {
      currentPageRef.current = 0;
      setCarouselIndex(0);
      return;
    }

    const initialPage = isLooping ? 1 : 0;
    requestAnimationFrame(() => jumpToPage(initialPage));
  }, [isLooping, itemIdentity, items.length, jumpToPage, pageStep]);

  const renderPage = useCallback(
    ({ item: page }: { item: CarouselPage }) => (
      <CarouselSlide
        imageInfo={carouselImageInfos[page.logicalIndex]}
        item={page.item}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        onPress={handleCarouselItemPress}
      />
    ),
    [cardHeight, cardWidth, carouselImageInfos, handleCarouselItemPress],
  );

  const currentItem = items[carouselIndex];
  const currentImageInfo = carouselImageInfos[carouselIndex];

  return (
    <View style={[styles.container, { height }]}>
      {!hasImages && (
        <View style={[StyleSheet.absoluteFill, styles.carouselPlaceholder]}>
          <Ionicons name="film-outline" size={52} color={theme.colors.textTertiary} />
        </View>
      )}
      {hasImages && (
        <FlatList
          ref={listRef}
          horizontal
          data={pages}
          renderItem={renderPage}
          keyExtractor={(page) => page.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={pageStep}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          bounces={false}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: pageStep,
            offset: pageStep * index,
            index,
          })}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        />
      )}
      {!!currentItem && (
        <CarouselOverlay
          activeIndex={carouselIndex}
          imageInfo={currentImageInfo}
          item={currentItem}
          items={items}
          showLogo={showLogo}
        />
      )}
    </View>
  );
}

const CAROUSEL_OVERLAY_LEFT_INSET = 56;
const CAROUSEL_OVERLAY_RIGHT_INSET = 18;

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  carouselCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    justifyContent: 'flex-end',
  },
  cardInner: {
    gap: 8,
  },
  titleBounds: {
    width: '100%',
    paddingLeft: CAROUSEL_OVERLAY_LEFT_INSET,
    paddingRight: CAROUSEL_OVERLAY_RIGHT_INSET,
    overflow: 'hidden',
  },
  cardTitle: {
    letterSpacing: 0,
    minWidth: 0,
    flexShrink: 1,
    ...TEXT_SHADOW,
  },
  cardLogo: {
    height: 40,
    width: '60%',
    alignSelf: 'flex-start',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    width: '100%',
    paddingLeft: CAROUSEL_OVERLAY_LEFT_INSET,
    paddingRight: CAROUSEL_OVERLAY_RIGHT_INSET,
    overflow: 'hidden',
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.85)',
    ...TEXT_SHADOW,
  },
  cardTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardTagOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cardTagText: {
    ...TEXT_SHADOW,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 16,
  },
});
