import { ItemImage } from '@/components/ItemImage';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { SkeletonMediaHero } from '@/components/ui/Skeleton';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
        priority="high"
        placeholderBlurhash={imageInfo.blurhash}
        recyclingKey={imageInfo.imageUrl}
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

type CarouselFrameProps = {
  imageInfo?: CarouselImageInfo;
};

function CarouselFrame({ imageInfo }: CarouselFrameProps) {
  return (
    <View style={styles.frame}>
      <CarouselImageLayer imageInfo={imageInfo} />
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
    <View pointerEvents="none" style={styles.bottomOverlay}>
      <View style={styles.cardInner}>
        <View style={styles.titleBounds}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.cardLogo}
              contentFit="contain"
              cachePolicy="memory-disk"
              recyclingKey={logoUrl}
            />
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
  );
}

function CarouselGradientScrim() {
  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.78)']}
      locations={[0.42, 1]}
      style={styles.gradientScrim}
      pointerEvents="none"
    />
  );
}

export function useCarouselHeaderLayers({
  items,
  height,
  isFocused,
  isLoading = false,
  showLogo = false,
}: CarouselHeaderProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [autoTargetIndex, setAutoTargetIndex] = useState<number | null>(null);
  const [isGestureOverlayVisible, setIsGestureOverlayVisible] = useState(false);
  const [pendingGestureSettleIndex, setPendingGestureSettleIndex] = useState<number | null>(null);
  const currentIndexRef = useRef(0);
  const router = useTracedRouter('carousel');
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const dragX = useSharedValue(0);
  const autoProgress = useSharedValue(0);
  const activeIndexValue = useSharedValue(0);
  const tapStartIndexValue = useSharedValue(0);
  const isGestureAnimating = useSharedValue(false);
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
      setPendingGestureSettleIndex(nextIndex);
      setCarouselIndex(nextIndex);
      setAutoTargetIndex(null);
      autoProgress.value = 0;
    },
    [activeIndexValue, autoProgress, items.length],
  );

  const completeAutoAdvance = useCallback(
    (nextIndex: number) => {
      currentIndexRef.current = nextIndex;
      activeIndexValue.value = nextIndex;
      setCarouselIndex(nextIndex);
      setAutoTargetIndex(null);
      setIsGestureOverlayVisible(false);
      dragX.value = 0;
    },
    [activeIndexValue, dragX],
  );

  const clearAutoTarget = useCallback(() => {
    setAutoTargetIndex(null);
  }, []);

  const showGestureOverlay = useCallback(() => {
    setIsGestureOverlayVisible(true);
  }, []);

  const hideGestureOverlay = useCallback(() => {
    setIsGestureOverlayVisible(false);
  }, []);

  const startAutoAdvance = useCallback(() => {
    if (!canReveal || !items.length) return;
    const nextIndex = getRelativeIndex(currentIndexRef.current, 1, items.length);

    setAutoTargetIndex(nextIndex);
    setIsGestureOverlayVisible(false);
  }, [canReveal, items.length]);

  useEffect(() => {
    if (autoTargetIndex == null) return;

    cancelAnimation(autoProgress);
    cancelAnimation(dragX);
    autoProgress.value = 0;
    dragX.value = 0;
    autoProgress.value = withTiming(1, { duration: CAROUSEL_AUTO_FADE_MS }, (finished) => {
      if (finished) {
        runOnJS(completeAutoAdvance)(autoTargetIndex);
      }
    });

    return () => {
      cancelAnimation(autoProgress);
    };
  }, [autoProgress, autoTargetIndex, completeAutoAdvance, dragX]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canReveal)
        .activeOffsetX([-12, 12])
        .failOffsetY([-18, 18])
        .onStart(() => {
          isGestureAnimating.value = true;
          runOnJS(showGestureOverlay)();
          cancelAnimation(autoProgress);
          autoProgress.value = 0;
          runOnJS(clearAutoTarget)();
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
            dragX.value = withTiming(
              -cardWidth,
              { duration: CAROUSEL_GESTURE_SETTLE_MS },
              (finished) => {
                if (finished) {
                  runOnJS(completeReveal)(1);
                }
              },
            );
            return;
          }

          if (wantsPrevious) {
            dragX.value = withTiming(
              cardWidth,
              { duration: CAROUSEL_GESTURE_SETTLE_MS },
              (finished) => {
                if (finished) {
                  runOnJS(completeReveal)(-1);
                }
              },
            );
            return;
          }

          dragX.value = withTiming(0, { duration: CAROUSEL_CANCEL_SETTLE_MS }, (finished) => {
            if (finished) {
              isGestureAnimating.value = false;
              runOnJS(hideGestureOverlay)();
            }
          });
        })
        .onFinalize((_event, success) => {
          if (!success) {
            dragX.value = withTiming(0, { duration: CAROUSEL_CANCEL_SETTLE_MS }, (finished) => {
              if (finished) {
                isGestureAnimating.value = false;
                runOnJS(hideGestureOverlay)();
              }
            });
          }
        }),
    [
      autoProgress,
      canReveal,
      cardWidth,
      clearAutoTarget,
      completeReveal,
      dragX,
      hideGestureOverlay,
      isGestureAnimating,
      showGestureOverlay,
    ],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(10)
        .onBegin(() => {
          tapStartIndexValue.value = activeIndexValue.value;
          cancelAnimation(autoProgress);
          autoProgress.value = 0;
          runOnJS(clearAutoTarget)();
        })
        .onEnd((_event, success) => {
          if (success) {
            runOnJS(handleCarouselItemPressAtIndex)(tapStartIndexValue.value);
          }
        }),
    [
      activeIndexValue,
      autoProgress,
      clearAutoTarget,
      handleCarouselItemPressAtIndex,
      tapStartIndexValue,
    ],
  );

  const carouselGesture = useMemo(
    () => (canReveal ? Gesture.Exclusive(panGesture, tapGesture) : tapGesture),
    [canReveal, panGesture, tapGesture],
  );

  const nextRevealStyle = useAnimatedStyle(() => {
    if (!isGestureAnimating.value) {
      return { opacity: 0 };
    }

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
    if (!isGestureAnimating.value) {
      return { opacity: 0 };
    }

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

  const autoFadeStyle = useAnimatedStyle(() => {
    return {
      opacity: autoProgress.value,
    };
  });

  const autoOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: autoProgress.value,
    };
  });

  const currentOverlayStyle = useAnimatedStyle(() => {
    const overlayOffset = isGestureAnimating.value ? dragX.value : 0;
    const dragProgress = isGestureAnimating.value
      ? Math.min(Math.abs(dragX.value) / cardWidth, 1)
      : 0;

    return {
      opacity: (1 - dragProgress) * (1 - autoProgress.value),
      transform: [{ translateX: overlayOffset }],
    };
  }, [cardWidth]);

  const nextOverlayStyle = useAnimatedStyle(() => {
    if (!isGestureAnimating.value) {
      return { opacity: 0 };
    }

    const progress = dragX.value < 0 ? Math.min(Math.abs(dragX.value) / cardWidth, 1) : 0;

    return {
      opacity: progress,
      transform: [{ translateX: cardWidth + dragX.value }],
    };
  }, [cardWidth]);

  const previousOverlayStyle = useAnimatedStyle(() => {
    if (!isGestureAnimating.value) {
      return { opacity: 0 };
    }

    const progress = dragX.value > 0 ? Math.min(Math.abs(dragX.value) / cardWidth, 1) : 0;

    return {
      opacity: progress,
      transform: [{ translateX: -cardWidth + dragX.value }],
    };
  }, [cardWidth]);

  useEffect(() => {
    currentIndexRef.current = 0;
    activeIndexValue.value = 0;
    autoProgress.value = 0;
    dragX.value = 0;
    isGestureAnimating.value = false;
    setAutoTargetIndex(null);
    setIsGestureOverlayVisible(false);
    setPendingGestureSettleIndex(null);
    setCarouselIndex(0);
  }, [activeIndexValue, autoProgress, dragX, isGestureAnimating, itemIdentity]);

  useEffect(() => {
    activeIndexValue.value = carouselIndex;
  }, [activeIndexValue, carouselIndex]);

  useLayoutEffect(() => {
    if (autoTargetIndex != null) return;

    autoProgress.value = 0;
  }, [autoProgress, autoTargetIndex, carouselIndex]);

  useLayoutEffect(() => {
    if (pendingGestureSettleIndex == null || carouselIndex !== pendingGestureSettleIndex) return;

    setPendingGestureSettleIndex(null);
    setIsGestureOverlayVisible(false);
    dragX.value = 0;
    isGestureAnimating.value = false;
  }, [carouselIndex, dragX, isGestureAnimating, pendingGestureSettleIndex]);

  useEffect(() => {
    if (!isFocused || !canReveal) return;
    const timer = setInterval(() => {
      if (autoTargetIndex != null || Math.abs(dragX.value) > 1 || autoProgress.value > 0) return;
      startAutoAdvance();
    }, CAROUSEL_AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoProgress, autoTargetIndex, canReveal, dragX, isFocused, startAutoAdvance]);

  useEffect(() => {
    const imageUrls = carouselImageInfos
      .map((imageInfo) => imageInfo.imageUrl)
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl));
    if (imageUrls.length === 0) return;

    void Image.prefetch(imageUrls, { cachePolicy: 'memory-disk' }).catch((error) => {
      console.warn('Failed to prefetch carousel images', error);
    });
  }, [carouselImageInfos]);

  const currentItem = items[carouselIndex];
  const currentImageInfo = carouselImageInfos[carouselIndex];
  const nextIndex = getRelativeIndex(carouselIndex, 1, items.length);
  const previousIndex = getRelativeIndex(carouselIndex, -1, items.length);
  const autoTargetItem = autoTargetIndex != null ? items[autoTargetIndex] : undefined;
  const autoTargetImageInfo =
    autoTargetIndex != null ? carouselImageInfos[autoTargetIndex] : undefined;
  const showSkeleton = isLoading && !hasImages;

  const headerImage = (
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
              <CarouselFrame imageInfo={currentImageInfo} />
            </View>

            {autoTargetIndex != null && (
              <Animated.View pointerEvents="none" style={[styles.autoFadeFrame, autoFadeStyle]}>
                <CarouselFrame imageInfo={autoTargetImageInfo} />
              </Animated.View>
            )}

            {canReveal && isGestureOverlayVisible && (
              <>
                <Animated.View pointerEvents="none" style={[styles.revealClip, nextRevealStyle]}>
                  <Animated.View style={[styles.revealImage, nextRevealImageStyle]}>
                    <CarouselFrame imageInfo={carouselImageInfos[nextIndex]} />
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.revealClip, previousRevealStyle]}
                >
                  <Animated.View style={[styles.revealImage, previousRevealImageStyle]}>
                    <CarouselFrame imageInfo={carouselImageInfos[previousIndex]} />
                  </Animated.View>
                </Animated.View>
              </>
            )}

            <CarouselGradientScrim />
          </View>
        </GestureDetector>
      )}
    </View>
  );

  const headerOverlay =
    !showSkeleton && hasImages ? (
      <View pointerEvents="none" style={[styles.container, { height }]}>
        {!!currentItem && (
          <Animated.View pointerEvents="none" style={[styles.overlayFrame, currentOverlayStyle]}>
            <CarouselOverlay
              activeIndex={carouselIndex}
              imageInfo={currentImageInfo}
              item={currentItem}
              items={items}
              showLogo={showLogo}
            />
          </Animated.View>
        )}

        {autoTargetIndex != null && !!autoTargetItem && (
          <Animated.View pointerEvents="none" style={[styles.overlayFrame, autoOverlayStyle]}>
            <CarouselOverlay
              activeIndex={autoTargetIndex}
              imageInfo={autoTargetImageInfo}
              item={autoTargetItem}
              items={items}
              showLogo={showLogo}
            />
          </Animated.View>
        )}

        {canReveal && isGestureOverlayVisible && !!items[nextIndex] && (
          <Animated.View pointerEvents="none" style={[styles.overlayFrame, nextOverlayStyle]}>
            <CarouselOverlay
              activeIndex={nextIndex}
              imageInfo={carouselImageInfos[nextIndex]}
              item={items[nextIndex]}
              items={items}
              showLogo={showLogo}
            />
          </Animated.View>
        )}

        {canReveal && isGestureOverlayVisible && !!items[previousIndex] && (
          <Animated.View pointerEvents="none" style={[styles.overlayFrame, previousOverlayStyle]}>
            <CarouselOverlay
              activeIndex={previousIndex}
              imageInfo={carouselImageInfos[previousIndex]}
              item={items[previousIndex]}
              items={items}
              showLogo={showLogo}
            />
          </Animated.View>
        )}
      </View>
    ) : null;

  return {
    backgroundImageInfo: autoTargetImageInfo ?? currentImageInfo,
    headerImage,
    headerOverlay,
  };
}

export function CarouselHeader(props: CarouselHeaderProps) {
  const { headerImage, headerOverlay } = useCarouselHeaderLayers(props);

  return (
    <View style={[styles.container, { height: props.height }]}>
      <View style={StyleSheet.absoluteFill}>{headerImage}</View>
      {!!headerOverlay && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {headerOverlay}
        </View>
      )}
    </View>
  );
}

const CAROUSEL_AUTO_INTERVAL_MS = 6500;
const CAROUSEL_AUTO_FADE_MS = 280;
const CAROUSEL_GESTURE_SETTLE_MS = 240;
const CAROUSEL_CANCEL_SETTLE_MS = 180;
const CAROUSEL_OVERLAY_LEFT_INSET = 24;
const CAROUSEL_OVERLAY_RIGHT_INSET = 20;

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
  frame: {
    width: '100%',
    height: '100%',
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
  autoFadeFrame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
  },
  overlayFrame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 4,
  },
  gradientScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  gradientScrimMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 116,
    height: 96,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  gradientScrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 136,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: CAROUSEL_OVERLAY_LEFT_INSET,
    right: CAROUSEL_OVERLAY_RIGHT_INSET,
    paddingBottom: 16,
    justifyContent: 'flex-end',
  },
  cardInner: {
    gap: 8,
  },
  titleBounds: {
    width: '100%',
    minWidth: 0,
  },
  cardTitle: {
    letterSpacing: 0,
    minWidth: 0,
    width: '100%',
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
    minWidth: 0,
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
