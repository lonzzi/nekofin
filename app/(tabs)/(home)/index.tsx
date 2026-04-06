import { AvatarImage } from '@/components/AvatarImage';
import { CarouselHeader } from '@/components/home/CarouselHeader';
import { Section } from '@/components/media/Section';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UserViewSection } from '@/components/user-view/UserViewSection';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import {
  useNavigation,
  useNavigationContainerRef,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';

export default function HomeScreen() {
  const { servers, currentServer, setCurrentServer, refreshServerInfo, isInitialized } =
    useMediaServers();
  const navigation = useNavigation();
  const navigationRef = useNavigationContainerRef();
  const rootNavigationState = useRootNavigationState();

  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');

  const headerHeight = useHeaderHeight();
  const { height: windowHeight } = useWindowDimensions();
  const carouselHeight = windowHeight * 0.6;

  const router = useRouter();

  const { sections, randomItemsQuery } = useHomeSections(currentServer);
  const isFocused = useIsFocused();

  const carouselItems = useMemo(() => {
    return randomItemsQuery.data ?? [];
  }, [randomItemsQuery.data]);

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

  // Stabilize onViewAll callbacks
  const handleViewAllResume = useCallback(() => router.push('/view-all/resume'), [router]);
  const handleViewAllNextup = useCallback(() => router.push('/view-all/nextup'), [router]);

  // Build stable onViewAll callbacks for latest sections
  const latestViewAllHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    for (const section of sections) {
      if (section.type === 'latest') {
        const folderId = section.key.replace('latest_', '');
        const folderName = section.title.replace('最近添加的 ', '');
        handlers[section.key] = () =>
          router.push({
            pathname: '/view-all/[type]',
            params: { folderId, folderName, type: 'latest' },
          });
      }
    }
    return handlers;
  }, [sections, router]);

  const headerImage = useMemo(
    () => <CarouselHeader items={carouselItems} height={carouselHeight} isFocused={isFocused} />,
    [carouselItems, carouselHeight, isFocused],
  );

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
      contentInset={{ top: -headerHeight }}
      style={{ flex: 1, backgroundColor }}
      headerHeight={carouselHeight}
      contentStyle={{ gap: 2, backgroundColor }}
      headerImage={headerImage}
    >
      <View style={{ gap: 24, marginTop: 24 }}>
        {sections.map((section) => {
          if (section.type === 'resume') {
            if (!section.isLoading && section.items.length === 0) return null;
            return (
              <Section
                key={section.key}
                title={section.title}
                onViewAll={handleViewAllResume}
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
                onViewAll={handleViewAllNextup}
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
            return (
              <Section
                key={section.key}
                title={section.title}
                onViewAll={latestViewAllHandlers[section.key]}
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
