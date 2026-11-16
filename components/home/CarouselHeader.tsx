import { HOME_CAROUSEL_IMAGE_WIDTHS } from '@/components/home/homePerformanceConfig';
import { ItemImage } from '@/components/ItemImage';
import { getEpisodeCardRoute, getSeriesCardRoute } from '@/components/media/cardHelpers';
import { getSourcedMediaKey, type GetMediaItemSource } from '@/components/media/mediaSource';
import { RetryableImage } from '@/components/RetryableImage';
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
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
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
  isCarouselSlideReady,
  type CarouselImageKeys,
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
  withBackdrop?: boolean;
}

type CarouselImageInfo = {
  key: string;
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
  onImageReady: () => void;
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
        onError={onImageReady}
        onDisplay={onImageReady}
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
  dragReady: SharedValue<{ previous: boolean; next: boolean }>;
};

function useCarouselSlidePresentation({
  index,
  count,
  width,
  activeIndex,
  autoTarget,
  autoProgress,
  drag,
  dragging,
  dragReady,
}: CarouselMotionProps) {
  return useDerivedValue(() => {
    const current = activeIndex.value;
    const offset = drag.value;
    return getCarouselPresentation(
      index,
      current,
      count,
      autoTarget.value,
      autoProgress.value,
      offset,
      dragging.value,
      width,
      offset < 0 ? dragReady.value.next : dragReady.value.previous,
    );
  });
}

type CarouselImageStatus = (key: string, ready: boolean) => void;

function useCarouselImageReady(imageKey: string | undefined, setImageReady: CarouselImageStatus) {
  useEffect(
    () => () => {
      if (imageKey) setImageReady(imageKey, false);
    },
    [imageKey, setImageReady],
  );
  return useCallback(() => {
    if (imageKey) setImageReady(imageKey, true);
  }, [imageKey, setImageReady]);
}

function CarouselSlide({
  imageInfo,
  imageKey,
  setImageReady,
  ...motion
}: CarouselMotionProps & {
  imageInfo?: CarouselImageInfo;
  imageKey?: string;
  setImageReady: CarouselImageStatus;
}) {
  const presentation = useCarouselSlidePresentation(motion);
  const frameStyle = useAnimatedStyle(() => {
    const { opacity, order, offset } = presentation.value;
    return { opacity, zIndex: order, transform: [{ translateX: offset }] };
  });
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -presentation.value.offset }],
  }));
  const markReady = useCarouselImageReady(imageKey, setImageReady);
  return (
    <Animated.View pointerEvents="none" style={[styles.revealClip, frameStyle]}>
      <Animated.View style={[styles.revealImage, imageStyle]}>
        <CarouselImageLayer imageInfo={imageInfo} onImageReady={markReady} />
      </Animated.View>
    </Animated.View>
  );
}

function CarouselBackdropSlide({
  imageInfo,
  imageKey,
  setImageReady,
  ...motion
}: CarouselMotionProps & {
  imageInfo?: CarouselImageInfo['atmosphere'];
  imageKey?: string;
  setImageReady: CarouselImageStatus;
}) {
  const theme = useAppTheme();
  const large = useLargeContentLayout();
  const presentation = useCarouselSlidePresentation(motion);
  const backdropStyle = useAnimatedStyle(() => {
    const { opacity, offset, order, textOpacity } = presentation.value;
    return { opacity: offset === 0 ? opacity : textOpacity, zIndex: order };
  });
  const markReady = useCarouselImageReady(imageKey, setImageReady);
  const blurhash = imageInfo?.blurhash;
  const placeholder = useMemo(() => (blurhash ? { blurhash } : undefined), [blurhash]);
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }, backdropStyle]}
    >
      {imageInfo?.imageUrl || placeholder ? (
        <RetryableImage
          uri={imageInfo?.imageUrl}
          style={StyleSheet.absoluteFill}
          placeholder={placeholder}
          contentFit="cover"
          placeholderContentFit="cover"
          blurRadius={60}
          priority="low"
          enforceEarlyResizing
          allowDownscaling={!(Platform.OS === 'android' && large)}
          cachePolicy="memory-disk"
          onDisplay={markReady}
          onError={markReady}
        />
      ) : null}
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
  const presentation = useCarouselSlidePresentation(motion);
  const textStyle = useAnimatedStyle(() => {
    const { textOpacity, textOffset } = presentation.value;
    return { opacity: textOpacity, transform: [{ translateX: textOffset }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.overlayFrame, textStyle]}>
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
  withBackdrop = false,
}: CarouselHeaderProps) {
  const { t: tr } = useTranslation();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const prefetchedImageUrlsRef = useRef(new Set<string>());
  const router = useTracedRouter('carousel');
  const queryClient = useQueryClient();
  const currentAdapter = useMediaAdapter();
  const { currentServer, setCurrentServer } = useMediaServers();
  const theme = useAppTheme();
  const { width: viewportWidth } = useContentDimensions();
  const dragX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const dragReady = useSharedValue({ previous: false, next: false });
  const panActive = useSharedValue(false);
  const autoProgress = useSharedValue(0);
  const autoTargetValue = useSharedValue(-1);
  const pendingTarget = useSharedValue(-1);
  const readyImages = useSharedValue<Record<string, boolean>>({});
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

  const carouselImageInfos = useMemo(() => {
    return items.map((item, index) => {
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
        key: getItemSource ? getSourcedMediaKey(item, source) : getCarouselItemKey(item, index),
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
  const itemIdentity = carouselImageInfos.map(({ key }) => key).join('|');
  const imageKeys = useMemo<CarouselImageKeys[]>(
    () =>
      carouselImageInfos.map(({ key, imageUrl, atmosphere }) => ({
        hero: imageUrl ? JSON.stringify([key, 'hero', imageUrl]) : undefined,
        atmosphere:
          withBackdrop && atmosphere.imageUrl
            ? JSON.stringify([key, 'atmosphere', atmosphere.imageUrl])
            : undefined,
      })),
    [carouselImageInfos, withBackdrop],
  );

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

      const route = item.type === 'Episode' ? getEpisodeCardRoute(item) : getSeriesCardRoute(item);
      if (route) {
        router.push(route);
      } else if (item.seriesId) {
        router.push({ pathname: '/series/[id]', params: { id: item.seriesId } });
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

  const setImageReady = useCallback<CarouselImageStatus>(
    (key, ready) => {
      scheduleOnUI(() => {
        'worklet';
        const images = { ...readyImages.value };
        if (ready) images[key] = true;
        else delete images[key];
        readyImages.value = images;
      });
    },
    [readyImages],
  );

  // One fade drives the artwork, caption, and backdrop after both images settle.
  useAnimatedReaction(
    () => {
      const target = pendingTarget.value;
      return isFocused &&
        !isGestureAnimating.value &&
        isCarouselSlideReady(imageKeys[target], readyImages.value)
        ? target
        : -1;
    },
    (target) => {
      if (target < 0) return;
      pendingTarget.value = -1;
      autoProgress.value = 0;
      autoTargetValue.value = target;
      autoProgress.value = withTiming(
        1,
        { duration: CAROUSEL_FADE_MS, easing: Easing.inOut(Easing.sin) },
        (finished) => {
          if (!finished) return;
          activeIndexValue.value = target;
          autoTargetValue.value = -1;
          autoProgress.value = 0;
          scheduleOnRN(setCarouselIndex, target);
        },
      );
    },
  );

  useEffect(() => {
    if (isFocused) return;

    cancelAnimation(autoProgress);
    cancelAnimation(dragX);
    autoProgress.value = 0;
    autoTargetValue.value = -1;
    pendingTarget.value = -1;
    dragX.value = 0;
    isGestureAnimating.value = false;
  }, [autoProgress, autoTargetValue, dragX, isFocused, isGestureAnimating, pendingTarget]);

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
        if (target !== 0) scheduleOnRN(setCarouselIndex, nextIndex);
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
        pendingTarget.value = -1;
        cancelAnimation(dragX);
        dragStartX.value = dragX.value;
        const current = activeIndexValue.value;
        // Keep a cold destination hidden throughout this gesture, even when
        // its image arrives midway through the swipe.
        dragReady.value = {
          previous: isCarouselSlideReady(
            imageKeys[getRelativeIndex(current, -1, itemCount)],
            readyImages.value,
          ),
          next: isCarouselSlideReady(
            imageKeys[getRelativeIndex(current, 1, itemCount)],
            readyImages.value,
          ),
        };
      })
      .onUpdate((event) => {
        dragX.value = getCarouselDragOffset(dragStartX.value, event.translationX, cardWidth);
      })
      .onEnd((event) => {
        // A quick flick may end before its last move is delivered as onUpdate.
        dragX.value = getCarouselDragOffset(dragStartX.value, event.translationX, cardWidth);
        const target = getCarouselSnapTarget(dragX.value, event.velocityX, cardWidth);
        const canRevealTarget = target < 0 ? dragReady.value.next : dragReady.value.previous;
        const next = getRelativeIndex(activeIndexValue.value, target < 0 ? 1 : -1, itemCount);
        if (target !== 0 && !canRevealTarget) {
          // The destination has stayed hidden during the drag. Leave the current
          // image in place and fade when the requested images can be displayed.
          dragX.value = 0;
          isGestureAnimating.value = false;
          pendingTarget.value = next;
        } else {
          settle(target);
        }
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
    dragReady,
    dragStartX,
    dragX,
    isGestureAnimating,
    imageKeys,
    itemCount,
    panActive,
    pendingTarget,
    readyImages,
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
            pendingTarget.value = -1;
            scheduleOnRN(handleCarouselItemPressAtIndex, tapStartIndexValue.value);
          }
        }),
    [
      activeIndexValue,
      autoProgress,
      autoTargetValue,
      handleCarouselItemPressAtIndex,
      pendingTarget,
      tapStartIndexValue,
    ],
  );

  const carouselGesture = useMemo(
    () => (canReveal ? Gesture.Exclusive(panGesture, tapGesture) : tapGesture),
    [canReveal, panGesture, tapGesture],
  );

  useEffect(() => {
    prefetchedImageUrlsRef.current = new Set();
    cancelAnimation(autoProgress);
    cancelAnimation(dragX);
    activeIndexValue.value = 0;
    autoProgress.value = 0;
    autoTargetValue.value = -1;
    pendingTarget.value = -1;
    dragX.value = 0;
    isGestureAnimating.value = false;
    setCarouselIndex(0);
  }, [
    activeIndexValue,
    autoProgress,
    autoTargetValue,
    dragX,
    isGestureAnimating,
    itemIdentity,
    pendingTarget,
  ]);

  useEffect(() => {
    if (!isFocused || !canReveal) return;
    const timer = setInterval(() => {
      scheduleOnUI(() => {
        'worklet';
        if (isGestureAnimating.value || autoTargetValue.value >= 0 || pendingTarget.value >= 0)
          return;
        pendingTarget.value = getRelativeIndex(activeIndexValue.value, 1, itemCount);
      });
    }, CAROUSEL_AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    activeIndexValue,
    autoTargetValue,
    canReveal,
    carouselIndex,
    isFocused,
    isGestureAnimating,
    itemCount,
    pendingTarget,
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
    dragReady,
  };
  const slideKey = (index: number) => carouselImageInfos[index].key;
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
                imageKey={imageKeys[index].hero}
                setImageReady={setImageReady}
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
    backgroundImageInfo: carouselImageInfos[carouselIndex]?.atmosphere,
    backgroundLayers:
      withBackdrop && hasImages
        ? mountedIndexes.map((index) => (
            <CarouselBackdropSlide
              key={slideKey(index)}
              {...motion}
              index={index}
              imageInfo={carouselImageInfos[index].atmosphere}
              imageKey={imageKeys[index].atmosphere}
              setImageReady={setImageReady}
            />
          ))
        : undefined,
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
