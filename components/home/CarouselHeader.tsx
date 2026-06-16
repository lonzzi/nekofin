import { ItemImage } from '@/components/ItemImage';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/design-system';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

interface CarouselHeaderProps {
  items: MediaItem[];
  height: number;
  isFocused: boolean;
  showLogo?: boolean;
}

export function CarouselHeader({
  items,
  height,
  isFocused,
  showLogo = false,
}: CarouselHeaderProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const router = useRouter();
  const mediaAdapter = useMediaAdapter();
  const theme = useAppTheme();

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

  // Auto-play: advance to next page every 6.5s
  useEffect(() => {
    if (!isFocused || items.length <= 1) return;
    const timer = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % items.length;
        pagerRef.current?.setPage(next);
        return next;
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [isFocused, items.length]);

  // Reset index when items change
  useEffect(() => {
    if (items.length === 0) {
      setCarouselIndex(0);
      return;
    }
    if (carouselIndex >= items.length) {
      setCarouselIndex(0);
    }
  }, [carouselIndex, items.length]);

  const updateCarouselIndex = useCallback(
    (nextIndex: number) => {
      if (items.length === 0) return;
      const boundedIndex = Math.min(Math.max(nextIndex, 0), items.length - 1);
      setCarouselIndex((currentIndex) =>
        currentIndex === boundedIndex ? currentIndex : boundedIndex,
      );
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

  const onPageScroll = useCallback(
    (e: { nativeEvent: { position: number; offset: number } }) => {
      const { position, offset } = e.nativeEvent;
      updateCarouselIndex(Math.round(position + offset));
    },
    [updateCarouselIndex],
  );

  const onPageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      updateCarouselIndex(e.nativeEvent.position);
    },
    [updateCarouselIndex],
  );

  const currentItem = items[carouselIndex];
  const currentImageInfo = carouselImageInfos[carouselIndex];
  const currentTitle = currentItem ? currentItem.seriesName || currentItem.name || '未知标题' : '';
  const currentLogoUrl = showLogo ? currentImageInfo?.logoImageUrl : undefined;

  const hasImages = items.length > 0;

  return (
    <View style={{ height }}>
      {!hasImages && (
        <View style={[StyleSheet.absoluteFill, styles.carouselPlaceholder]}>
          <Ionicons name="film-outline" size={52} color={theme.colors.textTertiary} />
        </View>
      )}
      {hasImages && (
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={0}
          overdrag
          onPageScroll={onPageScroll}
          onPageSelected={onPageSelected}
        >
          {items.map((item, index) => {
            const imageInfo = carouselImageInfos[index];
            const itemTitle = item.seriesName || item.name || '未知标题';
            return (
              <View key={item.id ?? `${item.type}-${item.seriesId ?? index}`} collapsable={false}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`打开 ${itemTitle}`}
                  style={styles.carouselCard}
                  onPress={() => handleCarouselItemPress(item)}
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
          })}
        </PagerView>
      )}

      {/* Bottom gradient scrim + info overlay only when images loaded */}
      {hasImages && (
        <>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.gradientScrim}
            pointerEvents="none"
          />

          <View pointerEvents="none" style={styles.bottomOverlay}>
            <View style={styles.overlayContent}>
              {currentItem && (
                <View style={styles.cardInner}>
                  {currentLogoUrl ? (
                    <Image
                      source={{ uri: currentLogoUrl }}
                      style={styles.cardLogo}
                      contentFit="contain"
                    />
                  ) : (
                    <ThemedText
                      style={[
                        theme.typography.title3,
                        styles.cardTitle,
                        { color: theme.colors.inverseText },
                      ]}
                      numberOfLines={1}
                    >
                      {currentTitle}
                    </ThemedText>
                  )}
                  <View style={styles.cardMetaRow}>
                    {currentItem.type === 'Movie' && (
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
                    {currentItem.type === 'Series' && (
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
                    {currentItem.productionYear && (
                      <ThemedText style={[theme.typography.footnote, styles.cardMeta]}>
                        {currentItem.productionYear}
                      </ThemedText>
                    )}
                    {currentItem.communityRating != null && (
                      <ThemedText style={[theme.typography.footnote, styles.cardMeta]}>
                        ★ {currentItem.communityRating.toFixed(1)}
                      </ThemedText>
                    )}
                    {currentItem.officialRating && (
                      <View style={[styles.cardTag, styles.cardTagOutline]}>
                        <ThemedText
                          style={[
                            theme.typography.caption,
                            styles.cardTagText,
                            { color: theme.colors.inverseText },
                          ]}
                        >
                          {currentItem.officialRating}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Dot indicators */}
              {items.length > 1 && (
                <View style={styles.dotsRow}>
                  {items.map((item, index) => (
                    <View
                      key={item.id ?? `${item.type}-${item.seriesId ?? index}`}
                      style={[
                        styles.dot,
                        index === carouselIndex && styles.dotActive,
                        {
                          backgroundColor:
                            index === carouselIndex
                              ? 'rgba(255,255,255,0.9)'
                              : 'rgba(255,255,255,0.35)',
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const CAROUSEL_OVERLAY_LEFT_INSET = 56;

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
    zIndex: 1,
  },
  carouselCard: {
    flex: 1,
    overflow: 'hidden',
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
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    zIndex: 2,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  overlayContent: {
    overflow: 'visible',
  },
  cardInner: {
    gap: 8,
  },
  cardTitle: {
    letterSpacing: 0,
    marginLeft: CAROUSEL_OVERLAY_LEFT_INSET,
    marginRight: 18,
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
    paddingLeft: CAROUSEL_OVERLAY_LEFT_INSET,
    paddingRight: 18,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 16,
  },
});
