import { HOME_CAROUSEL_IMAGE_WIDTHS } from '@/components/home/homePerformanceConfig';
import { ItemImage } from '@/components/ItemImage';
import { getSourcedMediaKey, type GetMediaItemSource } from '@/components/media/mediaSource';
import { ThemedText } from '@/components/ThemedText';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { SkeletonMediaHero } from '@/components/ui/Skeleton';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useContentDimensions, useLargeContentLayout } from '@/hooks/useContentDimensions';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { t as tr, useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { formatRating } from '@/lib/utils';
import { rememberDetailArtwork } from '@/services/media/detailArtwork';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import {
  CAROUSEL_FADE_MS,
  getCarouselDragOffset,
  getCarouselPresentation,
  getCarouselSnapDuration,
  getCarouselSnapTarget,
  getMountedCarouselIndexes,
} from './carouselMotion';

interface CarouselHeaderProps {
  items: MediaItem[];
  height: number;
  width?: number;
  isFocused: boolean;
  isLoading?: boolean;
  showLogo?: boolean;
  getItemSource?: GetMediaItemSource;
  showServerSource?: boolean;
}

type CarouselImageInfo = {
  atmosphere?: {
    blurhash?: string;
    imageUrl?: string;
  };
  imageUrl?: string;
  blurhash?: string;
  logoImageUrl?: string;
  serverName?: string;
};

function getCarouselItemKey(item: MediaItem, index: number) {
  return item.id ?? `${item.type}-${item.seriesId ?? index}`;
}

function getCarouselItemTitle(item: MediaItem) {
  return item.seriesName || item.name || tr('media.untitled');
}

function getRelativeIndex(index: number, direction: number, itemCount: number) {
  'worklet';
  if (itemCount <= 0) return 0;
  return (index + direction + itemCount) % itemCount;
}

type CarouselImageLayerProps = {
  imageInfo?: CarouselImageInfo;
  onImageReady?: (imageUrl: string) => void;
};

function CarouselImageLayer({ imageInfo, onImageReady }: CarouselImageLayerProps) {
  const theme = useAppTheme();
  const large = useLargeContentLayout();
  const mediaBackgroundColor = theme.isDark ? theme.colors.background : '#141416';
  const imageUrl = imageInfo?.imageUrl;

  if (imageUrl) {
    return (
      <ItemImage
        uri={imageUrl}
        style={[styles.carouselImage, { backgroundColor: mediaBackgroundColor }]}
        contentFit="cover"
        contentPosition="center"
        allowDownscaling={!(Platform.OS === 'android' && large)}
        cachePolicy="memory-disk"
        priority="high"
        placeholderBlurhash={imageInfo.blurhash}
        recyclingKey={imageUrl}
        onError={() => onImageReady?.(imageUrl)}
        onDisplay={() => onImageReady?.(imageUrl)}
      />
    );
  }

  return (
    <View
      style={[
        styles.carouselImage,
        styles.carouselPlaceholder,
        { backgroundColor: mediaBackgroundColor },
      ]}
    >
      <IconSymbol name="video.fill" size={48} color="#FFFFFF" />
    </View>
  );
}

type CarouselMotionProps = {
  index: number;
  count: number;
  width: number;
  activeIndex: SharedValue<number>;
  autoTarget: SharedValue<number>;
  autoProgress: SharedValue<number>;
  drag: SharedValue<number>;
  dragging: SharedValue<boolean>;
};

function useCarouselSlideStyles({
  index,
  count,
  width,
  activeIndex,
  autoTarget,
  autoProgress,
  drag,
  dragging,
}: CarouselMotionProps) {
  const frame = useAnimatedStyle(() => {
    const state = getCarouselPresentation(
      index,
      activeIndex.value,
      count,
      autoTarget.value,
      autoProgress.value,
      drag.value,
      dragging.value,
      width,
    );
    return {
      opacity: state.opacity,
      zIndex: state.order,
      transform: [{ translateX: state.offset }],
    };
  });
  const image = useAnimatedStyle(() => {
    const state = getCarouselPresentation(
      index,
      activeIndex.value,
      count,
      autoTarget.value,
      autoProgress.value,
      drag.value,
      dragging.value,
      width,
    );
    return { transform: [{ translateX: -state.offset }] };
  });
  const text = useAnimatedStyle(() => {
    const state = getCarouselPresentation(
      index,
      activeIndex.value,
      count,
      autoTarget.value,
      autoProgress.value,
      drag.value,
      dragging.value,
      width,
    );
    return { opacity: state.textOpacity, transform: [{ translateX: state.textOffset }] };
  });
  return { frame, image, text };
}

function CarouselSlide({
  imageInfo,
  onImageReady,
  onImageUnmount,
  ...motion
}: CarouselMotionProps & {
  imageInfo?: CarouselImageInfo;
  onImageReady: (url: string) => void;
  onImageUnmount: (url: string) => void;
}) {
  const animated = useCarouselSlideStyles(motion);
  const imageUrl = imageInfo?.imageUrl;
  useEffect(
    () => () => {
      if (imageUrl) onImageUnmount(imageUrl);
    },
    [imageUrl, onImageUnmount],
  );
  return (
    <Animated.View pointerEvents="none" style={[styles.revealClip, animated.frame]}>
      <Animated.View style={[styles.revealImage, animated.image]}>
        <CarouselImageLayer imageInfo={imageInfo} onImageReady={onImageReady} />
      </Animated.View>
    </Animated.View>
  );
}

function CarouselTextSlide({
  item,
  imageInfo,
  showLogo,
  ...motion
}: CarouselMotionProps & {
  item: MediaItem;
  imageInfo?: CarouselImageInfo;
  showLogo: boolean;
}) {
  const animated = useCarouselSlideStyles(motion);
  return (
    <Animated.View pointerEvents="none" style={[styles.overlayFrame, animated.text]}>
      <CarouselOverlay
        item={item}
        imageInfo={imageInfo}
        showLogo={showLogo}
        hasPagination={motion.count > 1}
      />
    </Animated.View>
  );
}

type CarouselOverlayProps = {
  imageInfo?: CarouselImageInfo;
  item: MediaItem;
  showLogo: boolean;
  hasPagination: boolean;
};

function CarouselBadge({ label, outlined = false }: { label: string; outlined?: boolean }) {
  const theme = useAppTheme();
  const isIOS = Platform.OS === 'ios';

  return (
    <GlassCard
      colorScheme="dark"
      fallbackBackgroundColor={outlined ? 'transparent' : 'rgba(255,255,255,0.2)'}
      radius={isIOS ? 999 : 6}
      style={[
        styles.cardTag,
        isIOS && styles.cardTagGlass,
        !isIOS && outlined && styles.cardTagOutline,
      ]}
      useGlassEffect={isIOS}
    >
      <ThemedText style={[theme.typography.caption, styles.cardTagText]}>{label}</ThemedText>
    </GlassCard>
  );
}

function CarouselOverlay({ imageInfo, item, showLogo, hasPagination }: CarouselOverlayProps) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const title = getCarouselItemTitle(item);
  const logoUrl = showLogo ? imageInfo?.logoImageUrl : undefined;
  const typeLabel =
    item.type === 'Movie' ? tr('media.movies') : item.type === 'Series' ? tr('media.series') : null;
  const titleFallback = (
    <ThemedText
      style={[theme.typography.title3, styles.cardTitle]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {title}
    </ThemedText>
  );

  return (
    <View
      pointerEvents="none"
      style={[styles.bottomOverlay, hasPagination && styles.overlayWithPagination]}
    >
      <View style={styles.cardInner}>
        <View style={styles.titleBounds}>
          {logoUrl ? (
            <ItemImage
              uri={logoUrl}
              style={styles.cardLogo}
              contentFit="contain"
              contentPosition="left center"
              cachePolicy="memory-disk"
              recyclingKey={logoUrl}
              fallback={titleFallback}
            />
          ) : (
            titleFallback
          )}
        </View>

        <View style={styles.cardMetaRow}>
          {!!imageInfo?.serverName && (
            <ThemedText style={[theme.typography.footnote, styles.cardMeta]} numberOfLines={1}>
              {imageInfo.serverName}
            </ThemedText>
          )}
          {typeLabel && <CarouselBadge label={typeLabel} />}
          {!!item.productionYear && (
            <ThemedText style={[theme.typography.footnote, styles.cardMeta]}>
              {item.productionYear}
            </ThemedText>
          )}
          {item.communityRating != null && (
            <ThemedText style={[theme.typography.footnote, styles.cardMeta]}>
              ★ {formatRating(item.communityRating)}
            </ThemedText>
          )}
          {!!item.officialRating && <CarouselBadge label={item.officialRating} outlined />}
        </View>
      </View>
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
  width,
  isFocused,
  isLoading = false,
  showLogo = false,
  getItemSource,
  showServerSource = true,
}: CarouselHeaderProps) {
  const { t: tr } = useTranslation();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [autoTargetIndex, setAutoTargetIndex] = useState<number | null>(null);
  const [pendingAutoAdvance, setPendingAutoAdvance] = useState<{
    fromIndex: number;
    targetIndex: number;
  } | null>(null);
  const currentIndexRef = useRef(0);
  const prefetchedImageUrlsRef = useRef(new Set<string>());
  const readyImageUrlsRef = useRef(new Set<string>());
  const [readyImageUrls, setReadyImageUrls] = useState<ReadonlySet<string>>(() => new Set());
  const router = useTracedRouter('carousel');
  const queryClient = useQueryClient();
  const currentAdapter = useMediaAdapter();
  const { currentServer, setCurrentServer } = useMediaServers();
  const theme = useAppTheme();
  const { width: viewportWidth } = useContentDimensions();
  const dragX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const panActive = useSharedValue(false);
  const autoProgress = useSharedValue(0);
  const autoTargetValue = useSharedValue(-1);
  const activeIndexValue = useSharedValue(0);
  const tapStartIndexValue = useSharedValue(0);
  const isGestureAnimating = useSharedValue(false);
  const itemCount = items.length;
  const hasImages = items.length > 0;
  // Gestures/preload stay structurally mounted regardless of focus (gated only by
  // `canReveal`) so returning to Home doesn't rebuild the carousel subtree on the
  // transition's last frame. `isFocused` only pauses/resumes side-effects
  // (timers, prefetch) below.
  const canReveal = items.length > 1;
  const cardWidth = Math.max(width ?? viewportWidth, 1);

  const itemIdentity = useMemo(
    () =>
      items
        .map((item, index) =>
          getItemSource
            ? getSourcedMediaKey(item, getItemSource(item))
            : getCarouselItemKey(item, index),
        )
        .join('|'),
    [items, getItemSource],
  );

  const carouselImageInfos = useMemo(() => {
    return items.map((item) => {
      const source = getItemSource?.(item);
      const mediaAdapter = source?.adapter ?? currentAdapter;
      const imageInfo = mediaAdapter.getImageInfo({
        item,
        opts: {
          preferBackdrop: true,
          preferThumb: true,
          width: HOME_CAROUSEL_IMAGE_WIDTHS.hero,
        },
      });
      const atmosphereImageInfo = mediaAdapter.getImageInfo({
        item,
        opts: {
          preferBackdrop: true,
          preferThumb: true,
          width: HOME_CAROUSEL_IMAGE_WIDTHS.atmosphere,
        },
      });
      const hasLogo = !!(
        item.imageTags?.Logo ||
        (item.parentLogoImageTag && item.parentLogoItemId)
      );
      const logoImageInfo =
        showLogo && hasLogo
          ? mediaAdapter.getImageInfo({
              item,
              opts: { preferLogo: true, width: 400 },
            })
          : null;
      return {
        atmosphere: {
          blurhash: atmosphereImageInfo.blurhash ?? imageInfo.blurhash,
          imageUrl: atmosphereImageInfo.url || imageInfo.url,
        },
        serverName: showServerSource ? source?.server.name : undefined,
        imageUrl: imageInfo.url,
        blurhash: imageInfo.blurhash,
        logoImageUrl: logoImageInfo?.url,
      };
    });
  }, [items, currentAdapter, getItemSource, showLogo, showServerSource]);

  const handleCarouselItemPress = useCallback(
    (item: MediaItem) => {
      if (!item?.id) return;
      const source = getItemSource?.(item);
      rememberDetailArtwork({
        client: queryClient,
        server: source?.server ?? currentServer,
        adapter: source?.adapter ?? currentAdapter,
        item,
        targetItemId: item.id,
      });
      if (source && currentServer?.id !== source.server.id) setCurrentServer(source.server);

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
    [router, getItemSource, currentServer, currentAdapter, queryClient, setCurrentServer],
  );

  const handleCarouselItemPressAtIndex = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) handleCarouselItemPress(item);
    },
    [handleCarouselItemPress, items],
  );

  const markCarouselImageReady = useCallback((imageUrl: string) => {
    if (readyImageUrlsRef.current.has(imageUrl)) return;
    const nextReadyUrls = new Set(readyImageUrlsRef.current);
    nextReadyUrls.add(imageUrl);
    readyImageUrlsRef.current = nextReadyUrls;
    setReadyImageUrls(nextReadyUrls);
  }, []);

  const markCarouselImageUnmounted = useCallback((imageUrl: string) => {
    if (!readyImageUrlsRef.current.has(imageUrl)) return;
    const next = new Set(readyImageUrlsRef.current);
    next.delete(imageUrl);
    readyImageUrlsRef.current = next;
    setReadyImageUrls(next);
  }, []);

  // UI worklets commit the visual state atomically. A delayed React update must
  // never reset the offset or index of a newer gesture.
  const syncCarouselIndex = useCallback((nextIndex: number) => {
    currentIndexRef.current = nextIndex;
    setCarouselIndex(nextIndex);
    setAutoTargetIndex(null);
  }, []);

  const clearAutoTarget = useCallback(() => {
    setAutoTargetIndex(null);
  }, []);

  const startAutoAdvance = useCallback(() => {
    if (!isFocused || !canReveal || !items.length) return;
    const requestedIndex = currentIndexRef.current;
    const nextIndex = getRelativeIndex(requestedIndex, 1, items.length);
    const nextImageUrl = carouselImageInfos[nextIndex]?.imageUrl;
    const isNextImageReady = !nextImageUrl || readyImageUrlsRef.current.has(nextImageUrl);

    if (!isNextImageReady) {
      setPendingAutoAdvance({ fromIndex: requestedIndex, targetIndex: nextIndex });
      return;
    }

    setPendingAutoAdvance(null);
    setAutoTargetIndex(nextIndex);
  }, [canReveal, carouselImageInfos, isFocused, items.length]);

  useEffect(() => {
    if (!pendingAutoAdvance) return;

    const targetImageUrl = carouselImageInfos[pendingAutoAdvance.targetIndex]?.imageUrl;
    if (targetImageUrl && !readyImageUrls.has(targetImageUrl)) return;

    if (!isFocused || currentIndexRef.current !== pendingAutoAdvance.fromIndex) {
      setPendingAutoAdvance(null);
      return;
    }

    if (
      isGestureAnimating.value ||
      autoTargetIndex != null ||
      Math.abs(dragX.value) > 1 ||
      autoProgress.value > 0
    )
      return;

    setAutoTargetIndex(pendingAutoAdvance.targetIndex);
    setPendingAutoAdvance(null);
  }, [
    autoProgress,
    autoTargetIndex,
    carouselImageInfos,
    dragX,
    isFocused,
    isGestureAnimating,
    pendingAutoAdvance,
    readyImageUrls,
  ]);

  useEffect(() => {
    if (autoTargetIndex == null) return;

    scheduleOnUI(() => {
      'worklet';
      // Image readiness can reach React just as a drag begins.
      if (isGestureAnimating.value) return;
      cancelAnimation(autoProgress);
      autoProgress.value = 0;
      autoTargetValue.value = autoTargetIndex;
      autoProgress.value = withTiming(
        1,
        { duration: CAROUSEL_FADE_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          activeIndexValue.value = autoTargetIndex;
          autoTargetValue.value = -1;
          autoProgress.value = 0;
          scheduleOnRN(syncCarouselIndex, autoTargetIndex);
        },
      );
    });

    return () => {
      cancelAnimation(autoProgress);
    };
  }, [
    activeIndexValue,
    autoProgress,
    autoTargetIndex,
    autoTargetValue,
    isGestureAnimating,
    syncCarouselIndex,
  ]);

  useEffect(() => {
    if (isFocused) return;

    cancelAnimation(autoProgress);
    cancelAnimation(dragX);
    autoProgress.value = 0;
    autoTargetValue.value = -1;
    dragX.value = 0;
    isGestureAnimating.value = false;
    setAutoTargetIndex(null);
    setPendingAutoAdvance(null);
  }, [autoProgress, autoTargetValue, dragX, isFocused, isGestureAnimating]);

  const panGesture = useMemo(() => {
    const settle = (target: number) => {
      'worklet';
      const nextIndex = getRelativeIndex(
        activeIndexValue.value,
        target === 0 ? 0 : target < 0 ? 1 : -1,
        itemCount,
      );
      const finish = () => {
        'worklet';
        activeIndexValue.value = nextIndex;
        dragX.value = 0;
        isGestureAnimating.value = false;
        if (target !== 0) scheduleOnRN(syncCarouselIndex, nextIndex);
      };
      const duration = getCarouselSnapDuration(dragX.value, target, cardWidth);
      // Repeated swipes can already reveal the entire destination. Commit now
      // instead of starting another cancellable 240 ms animation at its endpoint.
      if (duration === 0) {
        finish();
        return;
      }
      dragX.value = withTiming(target, { duration }, (finished) => {
        if (finished) finish();
      });
    };

    return Gesture.Pan()
      .enabled(canReveal)
      .activeOffsetX([-12, 12])
      .failOffsetY([-18, 18])
      .onStart(() => {
        panActive.value = true;
        isGestureAnimating.value = true;
        cancelAnimation(autoProgress);
        autoProgress.value = 0;
        autoTargetValue.value = -1;
        scheduleOnRN(clearAutoTarget);
        scheduleOnRN(setPendingAutoAdvance, null);
        cancelAnimation(dragX);
        dragStartX.value = dragX.value;
      })
      .onUpdate((event) => {
        dragX.value = getCarouselDragOffset(dragStartX.value, event.translationX, cardWidth);
      })
      .onEnd((event) => {
        // A quick flick may end before its last move is delivered as onUpdate.
        dragX.value = getCarouselDragOffset(dragStartX.value, event.translationX, cardWidth);
        settle(getCarouselSnapTarget(dragX.value, event.velocityX, cardWidth));
      })
      .onFinalize((_event, success) => {
        if (!success && panActive.value) settle(0);
        panActive.value = false;
      });
  }, [
    activeIndexValue,
    autoProgress,
    autoTargetValue,
    canReveal,
    cardWidth,
    clearAutoTarget,
    dragStartX,
    dragX,
    isGestureAnimating,
    itemCount,
    panActive,
    syncCarouselIndex,
  ]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(10)
        .onBegin(() => {
          tapStartIndexValue.value = activeIndexValue.value;
        })
        .onEnd((_event, success) => {
          if (success) {
            // A native toolbar or Drawer can cancel this touch after onBegin.
            // Only a recognized carousel tap should interrupt its automatic fade.
            cancelAnimation(autoProgress);
            autoProgress.value = 0;
            autoTargetValue.value = -1;
            scheduleOnRN(clearAutoTarget);
            scheduleOnRN(setPendingAutoAdvance, null);
            scheduleOnRN(handleCarouselItemPressAtIndex, tapStartIndexValue.value);
          }
        }),
    [
      activeIndexValue,
      autoProgress,
      autoTargetValue,
      clearAutoTarget,
      handleCarouselItemPressAtIndex,
      tapStartIndexValue,
    ],
  );

  const carouselGesture = useMemo(
    () => (canReveal ? Gesture.Exclusive(panGesture, tapGesture) : tapGesture),
    [canReveal, panGesture, tapGesture],
  );

  useEffect(() => {
    currentIndexRef.current = 0;
    prefetchedImageUrlsRef.current = new Set();
    // Reordered lists can retain keyed, already-displayed slides. Their readiness
    // belongs to the mounted image, and is cleared by that slide's cleanup.
    activeIndexValue.value = 0;
    autoProgress.value = 0;
    autoTargetValue.value = -1;
    dragX.value = 0;
    isGestureAnimating.value = false;
    setAutoTargetIndex(null);
    setPendingAutoAdvance(null);
    setCarouselIndex(0);
  }, [activeIndexValue, autoProgress, autoTargetValue, dragX, isGestureAnimating, itemIdentity]);

  useEffect(() => {
    if (!isFocused || !canReveal) return;
    const timer = setInterval(() => {
      if (
        isGestureAnimating.value ||
        autoTargetIndex != null ||
        Math.abs(dragX.value) > 1 ||
        autoProgress.value > 0
      )
        return;
      startAutoAdvance();
    }, CAROUSEL_AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    autoProgress,
    autoTargetIndex,
    canReveal,
    dragX,
    isFocused,
    isGestureAnimating,
    startAutoAdvance,
  ]);

  useEffect(() => {
    if (!isFocused) return;
    const imageUrls = Array.from(
      new Set(
        carouselImageInfos
          .flatMap((imageInfo) => [imageInfo.imageUrl, imageInfo.atmosphere?.imageUrl])
          .filter((imageUrl): imageUrl is string => Boolean(imageUrl)),
      ),
    );
    if (imageUrls.length === 0) return;

    const warmDiskUrls = imageUrls.filter(
      (imageUrl) => !prefetchedImageUrlsRef.current.has(imageUrl),
    );
    if (warmDiskUrls.length === 0) return;

    void Image.prefetch(warmDiskUrls, { cachePolicy: 'disk' })
      .then(() => {
        warmDiskUrls.forEach((imageUrl) => prefetchedImageUrlsRef.current.add(imageUrl));
      })
      .catch((error) => {
        console.warn('Failed to prefetch carousel images', error);
      });
  }, [carouselImageInfos, isFocused]);

  const currentItem = items[carouselIndex];
  const mountedIndexes = getMountedCarouselIndexes(carouselIndex, items.length);
  const motion = {
    count: items.length,
    width: cardWidth,
    activeIndex: activeIndexValue,
    autoTarget: autoTargetValue,
    autoProgress,
    drag: dragX,
    dragging: isGestureAnimating,
  };
  const slideKey = (index: number) =>
    getItemSource
      ? getSourcedMediaKey(items[index], getItemSource(items[index]))
      : getCarouselItemKey(items[index], index);
  const showSkeleton = isLoading && !hasImages;

  const headerImage = (
    <View style={[styles.container, { height: '100%' }]}>
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
              currentItem
                ? tr('media.openValue', { value: getCarouselItemTitle(currentItem) })
                : tr('media.openMedia')
            }
            onAccessibilityTap={() => {
              if (currentItem) handleCarouselItemPress(currentItem);
            }}
            style={styles.gestureSurface}
          >
            {mountedIndexes.map((index) => (
              <CarouselSlide
                key={slideKey(index)}
                {...motion}
                index={index}
                imageInfo={carouselImageInfos[index]}
                onImageReady={markCarouselImageReady}
                onImageUnmount={markCarouselImageUnmounted}
              />
            ))}

            <CarouselGradientScrim />
          </View>
        </GestureDetector>
      )}
    </View>
  );

  const headerOverlay =
    !showSkeleton && hasImages ? (
      <View pointerEvents="none" style={[styles.container, { height: '100%' }]}>
        {mountedIndexes.map((index) => (
          <CarouselTextSlide
            key={slideKey(index)}
            {...motion}
            index={index}
            item={items[index]}
            imageInfo={carouselImageInfos[index]}
            showLogo={showLogo}
          />
        ))}
        {canReveal && (
          <View style={styles.paginationOverlay}>
            {items.map((_, index) => (
              <View
                key={slideKey(index)}
                style={[styles.dot, index === carouselIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    ) : null;

  return {
    backgroundImageInfo: carouselImageInfos[autoTargetIndex ?? carouselIndex]?.atmosphere,
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

const CAROUSEL_AUTO_INTERVAL_MS = 10 * 1000;
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
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: CAROUSEL_OVERLAY_LEFT_INSET,
    right: CAROUSEL_OVERLAY_RIGHT_INSET,
    paddingBottom: 16,
    justifyContent: 'flex-end',
  },
  overlayWithPagination: {
    paddingBottom: 16 + 7 + 12,
  },
  cardInner: {
    gap: 8,
  },
  titleBounds: {
    width: '100%',
    minWidth: 0,
  },
  cardTitle: {
    // Poster overlays always need light text, independent of Material's onPrimary color.
    color: '#FFFFFF',
    letterSpacing: 0,
    minWidth: 0,
    width: '100%',
    flexShrink: 1,
    ...TEXT_SHADOW,
  },
  cardLogo: {
    height: 56,
    width: '70%',
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
  },
  cardTagGlass: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardTagOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cardTagText: {
    color: '#FFFFFF',
    ...TEXT_SHADOW,
  },
  paginationOverlay: {
    position: 'absolute',
    bottom: 16,
    left: CAROUSEL_OVERLAY_LEFT_INSET,
    right: CAROUSEL_OVERLAY_RIGHT_INSET,
    zIndex: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  dotActive: {
    width: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
