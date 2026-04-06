import { AvatarImage } from '@/components/AvatarImage';
import { ItemImage } from '@/components/ItemImage';
import { Section } from '@/components/media/Section';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UserViewSection } from '@/components/user-view/UserViewSection';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem } from '@/services/media/types';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import { useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import {
  useNavigation,
  useNavigationContainerRef,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import PagerView from 'react-native-pager-view';

export default function HomeScreen() {
  const { servers, currentServer, setCurrentServer, refreshServerInfo, isInitialized } =
    useMediaServers();
  const navigation = useNavigation();
  const navigationRef = useNavigationContainerRef();
  const rootNavigationState = useRootNavigationState();
  const mediaAdapter = useMediaAdapter();

  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');

  const carouselPlaceholderColor = useThemeColor(
    { light: '#d1d1d6', dark: '#2b2b2b' },
    'background',
  );

  const dotActiveColor = useThemeColor(
    { light: 'rgba(0,0,0,0.9)', dark: 'rgba(255,255,255,0.9)' },
    'text',
  );

  const dotInactiveColor = useThemeColor(
    { light: 'rgba(0,0,0,0.25)', dark: 'rgba(255,255,255,0.25)' },
    'text',
  );

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const { height: windowHeight } = useWindowDimensions();
  const carouselHeight = windowHeight * 0.7;

  const router = useRouter();

  const { sections, randomItemsQuery } = useHomeSections(currentServer);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const isFocused = useIsFocused();

  const carouselItems = useMemo(() => {
    return randomItemsQuery.data ?? [];
  }, [randomItemsQuery.data]);

  const carouselImageInfos = useMemo(() => {
    return carouselItems.map((item) => {
      const imageInfo = mediaAdapter.getImageInfo({
        item,
        opts: {
          preferBackdrop: true,
          preferThumb: true,
        },
      });
      const logoImageInfo = mediaAdapter.getImageInfo({
        item,
        opts: { preferLogo: true, width: 400 },
      });
      return {
        imageUrl: imageInfo.url,
        blurhash: imageInfo.blurhash,
        logoImageUrl: logoImageInfo.url?.replace('Primary', 'Logo'),
      };
    });
  }, [carouselItems, mediaAdapter]);

  // Auto-play: advance to next page every 6.5s
  useEffect(() => {
    if (!isFocused || carouselItems.length <= 1) return;
    const timer = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % carouselItems.length;
        pagerRef.current?.setPage(next);
        return next;
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [isFocused, carouselItems.length]);

  // Reset index when items change
  useEffect(() => {
    if (carouselItems.length === 0) {
      setCarouselIndex(0);
    }
  }, [carouselItems.length]);

  const handleServerSelect = useCallback(
    (serverId: string) => {
      setCurrentServer(servers.find((server) => server.id === serverId)!);
      refreshServerInfo(serverId);

      if (navigationRef.current && rootNavigationState) {
        const rootRoute = rootNavigationState.routes.find((route) => route.name === '__root');
        if (rootRoute && rootRoute.state) {
          const tabsRoute = rootRoute.state.routes.find((route) => route.name === '(tabs)');
          if (tabsRoute && tabsRoute.state) {
            const resetRoutes = tabsRoute.state.routes.map((route) => ({
              name: route.name,
              params: route.name === 'index' ? undefined : { screen: 'index' },
            }));

            navigationRef.current.reset({
              index: 0,
              routes: [
                {
                  name: '__root',
                  state: {
                    index: 0,
                    routes: [
                      {
                        name: '(tabs)',
                        state: {
                          index: 0,
                          routes: resetRoutes,
                        },
                      },
                    ],
                  },
                },
              ],
            });
          }
        }
      }
    },
    [servers, setCurrentServer, refreshServerInfo, navigationRef, rootNavigationState],
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        servers && servers.length > 0 ? (
          <View style={styles.headerButtons}>
            <MenuView
              isAnchoredToRight
              title="服务器列表"
              onPressAction={({ nativeEvent }) => {
                const serverId = nativeEvent.event;
                if (serverId && serverId !== 'current') {
                  handleServerSelect(serverId);
                }
              }}
              actions={[
                ...(servers.map((server) => ({
                  id: server.id,
                  title: server.name,
                  state:
                    currentServer?.id === server.id
                      ? 'on'
                      : Platform.select({
                          ios: 'off',
                          android: 'mixed',
                        }),
                })) as MenuAction[]),
              ]}
            >
              <TouchableOpacity style={styles.serverButton}>
                <AvatarImage
                  key={currentServer?.id}
                  avatarUri={currentServer?.userAvatar}
                  style={styles.serverButtonAvatar}
                />
              </TouchableOpacity>
            </MenuView>
          </View>
        ) : undefined,
    });
  }, [
    currentServer?.userAvatar,
    navigation,
    servers,
    currentServer?.id,
    handleServerSelect,
    currentServer,
  ]);

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

  // Current item info for text overlay
  const currentItem = carouselItems[carouselIndex];
  const currentImageInfo = carouselImageInfos[carouselIndex];
  const currentTitle = currentItem ? currentItem.seriesName || currentItem.name || '未知标题' : '';
  const currentLogoUrl = currentImageInfo?.logoImageUrl;

  if (servers.length === 0 && isInitialized) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <IconSymbol name="externaldrive.connected.to.line.below" size={48} color="#9AA0A6" />
        <ThemedText style={styles.emptyTitle}>还没有服务器</ThemedText>
        <ThemedText style={styles.emptySubtitle}>添加一个媒体服务器以开始使用</ThemedText>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/media')}>
          <ThemedText style={styles.primaryButtonText}>添加服务器</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ParallaxScrollView
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ top: -100 }}
      style={{ flex: 1, backgroundColor }}
      headerHeight={carouselHeight}
      contentStyle={{ gap: 2, backgroundColor }}
      headerImage={
        <View style={{ height: carouselHeight }}>
          {carouselItems.length > 0 && (
            <PagerView
              ref={pagerRef}
              style={styles.pagerView}
              initialPage={0}
              overdrag
              onPageSelected={(e) => setCarouselIndex(e.nativeEvent.position)}
            >
              {carouselItems.map((item, index) => {
                const imageInfo = carouselImageInfos[index];
                return (
                  <View
                    key={item.id ?? `${item.type}-${item.seriesId ?? index}`}
                    collapsable={false}
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.carouselCard}
                      onPress={() => handleCarouselItemPress(item)}
                    >
                      {imageInfo?.imageUrl ? (
                        <ItemImage
                          uri={imageInfo.imageUrl}
                          style={[styles.carouselImage, { backgroundColor }]}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          placeholderBlurhash={imageInfo.blurhash}
                        />
                      ) : (
                        <View
                          style={[
                            styles.carouselImage,
                            styles.carouselPlaceholder,
                            { backgroundColor: carouselPlaceholderColor },
                          ]}
                        >
                          <IconSymbol name="video.fill" size={48} color="rgba(255,255,255,0.9)" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </PagerView>
          )}

          {/* Info floating card */}
          {currentItem && (
            <View pointerEvents="none" style={styles.infoCard}>
              <BlurView
                intensity={60}
                tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardInner}>
                {currentLogoUrl ? (
                  <Image
                    source={{ uri: currentLogoUrl }}
                    style={styles.cardLogo}
                    contentFit="contain"
                  />
                ) : (
                  <ThemedText style={styles.cardTitle} numberOfLines={1}>
                    {currentTitle}
                  </ThemedText>
                )}
                <View style={styles.cardMetaRow}>
                  {currentItem.type === 'Movie' && (
                    <View
                      style={[
                        styles.cardTag,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
                      ]}
                    >
                      <ThemedText style={styles.cardTagText}>电影</ThemedText>
                    </View>
                  )}
                  {currentItem.type === 'Series' && (
                    <View
                      style={[
                        styles.cardTag,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
                      ]}
                    >
                      <ThemedText style={styles.cardTagText}>剧集</ThemedText>
                    </View>
                  )}
                  {currentItem.productionYear && (
                    <ThemedText style={styles.cardMeta}>{currentItem.productionYear}</ThemedText>
                  )}
                  {currentItem.communityRating != null && (
                    <ThemedText style={styles.cardMeta}>
                      ★ {currentItem.communityRating.toFixed(1)}
                    </ThemedText>
                  )}
                  {currentItem.officialRating && (
                    <View
                      style={[
                        styles.cardTag,
                        {
                          borderWidth: 1,
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                        },
                      ]}
                    >
                      <ThemedText style={styles.cardTagText}>
                        {currentItem.officialRating}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Dot indicators */}
          {carouselItems.length > 1 && (
            <View pointerEvents="none" style={styles.dotsOverlay}>
              {carouselItems.map((item, index) => (
                <View
                  key={item.id ?? `${item.type}-${item.seriesId ?? index}`}
                  style={[
                    styles.dot,
                    index === carouselIndex && styles.dotActive,
                    {
                      backgroundColor: index === carouselIndex ? dotActiveColor : dotInactiveColor,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      }
    >
      <View style={{ gap: 24, marginTop: 24 }}>
        {sections.map((section) => {
          if (section.type === 'resume') {
            if (!section.isLoading && section.items.length === 0) return null;
            return (
              <Section
                key={section.key}
                title={section.title}
                onViewAll={() => router.push('/view-all/resume')}
                items={section.items}
                isLoading={section.isLoading}
              />
            );
          }
          if (section.type === 'nextup') {
            if (!section.isLoading && section.items.length === 0) return null;
            return (
              <Section
                key={section.key}
                title={section.title}
                onViewAll={() => router.push('/view-all/nextup')}
                items={section.items}
                isLoading={section.isLoading}
              />
            );
          }
          if (section.type === 'userview') {
            return (
              <UserViewSection
                key={section.key}
                title={section.title}
                userView={section.items}
                isLoading={section.isLoading}
              />
            );
          }
          if (section.type === 'latest') {
            if (!section.isLoading && section.items.length === 0) return null;
            const folderId = section.key.replace('latest_', '');
            return (
              <Section
                key={section.key}
                title={section.title}
                onViewAll={() =>
                  router.push({
                    pathname: '/view-all/[type]',
                    params: {
                      folderId,
                      folderName: section.title.replace('最近添加的 ', ''),
                      type: 'latest',
                    },
                  })
                }
                items={section.items}
                isLoading={section.isLoading}
                type="series"
              />
            );
          }
          return null;
        })}
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pagerView: {
    flex: 1,
  },
  carouselCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#151718',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    position: 'absolute',
    bottom: 44,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 2,
  },
  cardInner: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
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
  },
  cardMeta: {
    fontSize: 13,
    opacity: 0.7,
  },
  cardTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotsOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 16,
  },
  serverButton: {
    borderWidth: 1,
    borderColor: '#f2f2f2',
    borderRadius: 64,
    backgroundColor: '#f2f2f2',
    overflow: 'hidden',
  },
  serverButtonAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
