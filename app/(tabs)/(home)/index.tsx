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
import { useNavigation, useRouter } from 'expo-router';
import { useHeaderHeight, useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

export default function HomeScreen() {
  const { servers, currentServer, isInitialized } = useMediaServers();
  const navigation = useNavigation();

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

  useEffect(() => {
    navigation.setOptions({
      headerRight: undefined,
    });
  }, [navigation]);

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
        <ThemedText style={styles.emptyTitle}>还没有媒体账号</ThemedText>
        <ThemedText style={styles.emptySubtitle}>添加 Jellyfin 或 Emby 账号以开始使用</ThemedText>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/media')}>
          <ThemedText style={styles.primaryButtonText}>添加媒体账号</ThemedText>
        </Pressable>
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
      <View style={styles.content}>
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
  content: {
    gap: 24,
    marginTop: 16,
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
