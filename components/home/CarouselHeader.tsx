import { ItemImage } from '@/components/ItemImage';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { SkeletonMediaHero } from '@/components/ui/Skeleton';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface CarouselHeaderProps {
  items: MediaItem[];
  height: number;
  isFocused: boolean;
  isLoading?: boolean;
  showLogo?: boolean;
}

type CarouselImageInfo = {
  imageUrl?: string;
  blurhash?: string;
  logoImageUrl?: string;
};

type RevealDirection = -1 | 1;

function getCarouselItemKey(item: MediaItem, index: number) {
  return item.id ?? `${item.type}-${item.seriesId ?? index}`;
}

function getCarouselItemTitle(item: MediaItem) {
  return item.seriesName || item.name || '未知标题';
}

function getRelativeIndex(index: number, direction: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  return (index + direction + itemCount) % itemCount;
}

type CarouselImageLayerProps = {
  imageInfo?: CarouselImageInfo;
};

function CarouselImageLayer({ imageInfo }: CarouselImageLayerProps) {
  const theme = useAppTheme();

  if (imageInfo?.imageUrl) {
    return (
      <ItemImage
        uri={imageInfo.imageUrl}
        style={[styles.carouselImage, { backgroundColor: theme.colors.background }]}
        contentFit="cover"
        contentPosition="left center"
        cachePolicy="memory-disk"
        placeholderBlurhash={imageInfo.blurhash}
      />
    );
  }

  return (
    <View
      style={[
        styles.carouselImage,
        styles.carouselPlaceholder,
        { backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      <IconSymbol name="video.fill" size={48} color={theme.colors.inverseText} />
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
  isLoading = false,
  showLogo = false,
}: CarouselHeaderProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const router = useRouter();
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const dragX = useSharedValue(0);
  const activeIndexValue = useSharedValue(0);
  const hasImages = items.length > 0;
  const canReveal = items.length > 1;
  const cardWidth = Math.max(viewportWidth, 1);

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

  const handleCarouselItemPressAtIndex = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) handleCarouselItemPress(item);
    },
    [handleCarouselItemPress, items],
  );

  const completeReveal = useCallback(
    (direction: RevealDirection) => {
      if (!items.length) return;
      const nextIndex = getRelativeIndex(currentIndexRef.current, direction, items.length);
      currentIndexRef.current = nextIndex;
      activeIndexValue.value = nextIndex;
      setCarouselIndex(nextIndex);
      dragX.value = 0;
    },
    [activeIndexValue, dragX, items.length],
  );

  const revealTo = useCallback(
    (direction: RevealDirection, duration = 620) => {
      if (!canReveal) return;
      cancelAnimation(dragX);
      dragX.value = 0;
      dragX.value = withTiming(
        direction === 1 ? -cardWidth : cardWidth,
        { duration },
        (finished) => {
          if (finished) {
            runOnJS(completeReveal)(direction);
          }
        },
      );
    },
    [canReveal, cardWidth, completeReveal, dragX],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canReveal)
        .activeOffsetX([-12, 12])
        .failOffsetY([-18, 18])
        .onBegin(() => {
          cancelAnimation(dragX);
        })
        .onUpdate((event) => {
          const nextTranslation = Math.max(-cardWidth, Math.min(cardWidth, event.translationX));
          dragX.value = nextTranslation;
        })
        .onEnd((event) => {
          const threshold = cardWidth * 0.22;
          const wantsNext = dragX.value < -threshold || event.velocityX < -650;
          const wantsPrevious = dragX.value > threshold || event.velocityX > 650;

          if (wantsNext) {
            dragX.value = withTiming(-cardWidth, { duration: 360 }, (finished) => {
              if (finished) {
                runOnJS(completeReveal)(1);
              }
            });
            return;
          }

          if (wantsPrevious) {
            dragX.value = withTiming(cardWidth, { duration: 360 }, (finished) => {
              if (finished) {
                runOnJS(completeReveal)(-1);
              }
            });
            return;
          }

          dragX.value = withTiming(0, { duration: 260 });
        })
        .onFinalize((_event, success) => {
          if (!success) {
            dragX.value = withTiming(0, { duration: 220 });
          }
        }),
    [canReveal, cardWidth, completeReveal, dragX],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(10)
        .onEnd((_event, success) => {
          if (success) {
            runOnJS(handleCarouselItemPressAtIndex)(activeIndexValue.value);
          }
        }),
    [activeIndexValue, handleCarouselItemPressAtIndex],
  );

  const carouselGesture = useMemo(
    () => (canReveal ? Gesture.Exclusive(panGesture, tapGesture) : tapGesture),
    [canReveal, panGesture, tapGesture],
  );

  const nextRevealStyle = useAnimatedStyle(() => {
    const revealOffset = Math.max(0, Math.min(cardWidth, cardWidth + Math.min(0, dragX.value)));

    return {
      opacity: dragX.value < 0 ? 1 : 0,
      transform: [{ translateX: revealOffset }],
    };
  }, [cardWidth]);

  const nextRevealImageStyle = useAnimatedStyle(() => {
    const revealOffset = Math.max(0, Math.min(cardWidth, cardWidth + Math.min(0, dragX.value)));

    return {
      transform: [{ translateX: -revealOffset }],
    };
  }, [cardWidth]);

  const previousRevealStyle = useAnimatedStyle(() => {
    const revealOffset = Math.min(0, Math.max(-cardWidth, -cardWidth + Math.max(0, dragX.value)));

    return {
      opacity: dragX.value > 0 ? 1 : 0,
      transform: [{ translateX: revealOffset }],
    };
  }, [cardWidth]);

  const previousRevealImageStyle = useAnimatedStyle(() => {
    const revealOffset = Math.min(0, Math.max(-cardWidth, -cardWidth + Math.max(0, dragX.value)));

    return {
      transform: [{ translateX: -revealOffset }],
    };
  }, [cardWidth]);

  const revealBoundaryStyle = useAnimatedStyle(() => {
    const boundaryX = dragX.value < 0 ? cardWidth + dragX.value : dragX.value;
    const opacity = Math.min(Math.abs(dragX.value) / 56, 1);

    return {
      opacity,
      transform: [{ translateX: boundaryX - 1 }],
    };
  }, [cardWidth]);

  useEffect(() => {
    currentIndexRef.current = 0;
    activeIndexValue.value = 0;
    dragX.value = 0;
    setCarouselIndex(0);
  }, [activeIndexValue, dragX, itemIdentity]);

  useEffect(() => {
    activeIndexValue.value = carouselIndex;
  }, [activeIndexValue, carouselIndex]);

  useEffect(() => {
    if (!isFocused || !canReveal) return;
    const timer = setInterval(() => {
      if (Math.abs(dragX.value) > 1) return;
      revealTo(1);
    }, CAROUSEL_AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [canReveal, dragX, isFocused, revealTo]);

  const currentItem = items[carouselIndex];
  const currentImageInfo = carouselImageInfos[carouselIndex];
  const nextIndex = getRelativeIndex(carouselIndex, 1, items.length);
  const previousIndex = getRelativeIndex(carouselIndex, -1, items.length);
  const showSkeleton = isLoading && !hasImages;

  return (
    <View style={[styles.container, { height }]}>
      {showSkeleton && <SkeletonMediaHero />}
      {!showSkeleton && !hasImages && (
        <View style={[StyleSheet.absoluteFill, styles.carouselPlaceholder]}>
          <Ionicons name="film-outline" size={52} color={theme.colors.textTertiary} />
        </View>
      )}
      {!showSkeleton && hasImages && (
        <GestureDetector gesture={carouselGesture}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              currentItem ? `打开 ${getCarouselItemTitle(currentItem)}` : '打开媒体'
            }
            onAccessibilityTap={() => {
              if (currentItem) handleCarouselItemPress(currentItem);
            }}
            style={styles.gestureSurface}
          >
            <View style={StyleSheet.absoluteFill}>
              <CarouselImageLayer imageInfo={currentImageInfo} />
            </View>

            {canReveal && (
              <>
                <Animated.View pointerEvents="none" style={[styles.revealClip, nextRevealStyle]}>
                  <Animated.View style={[styles.revealImage, nextRevealImageStyle]}>
                    <CarouselImageLayer imageInfo={carouselImageInfos[nextIndex]} />
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.revealClip, previousRevealStyle]}
                >
                  <Animated.View style={[styles.revealImage, previousRevealImageStyle]}>
                    <CarouselImageLayer imageInfo={carouselImageInfos[previousIndex]} />
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.revealBoundary, revealBoundaryStyle]}
                />
              </>
            )}
          </View>
        </GestureDetector>
      )}
      {!showSkeleton && !!currentItem && (
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

const CAROUSEL_AUTO_INTERVAL_MS = 6500;
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
  gestureSurface: {
    flex: 1,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealClip: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 2,
  },
  revealImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  revealBoundary: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    zIndex: 3,
    backgroundColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
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
