import { useCarouselHeaderLayers } from '@/components/home/CarouselHeader';
import { HomeAtmosphereScrollView } from '@/components/home/HomeAtmosphereScrollView';
import { Section } from '@/components/media/Section';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UserViewSection } from '@/components/user-view/UserViewSection';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const { servers, currentServer, isInitialized } = useMediaServers();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const carouselHeight = useMediaHeroHeight();

  const router = useRouter();

  const { sections, randomItemsQuery } = useHomeSections(currentServer);
  const isFocused = useIsFocused();

  const carouselItems = useMemo(() => {
    return randomItemsQuery.data ?? [];
  }, [randomItemsQuery.data]);

  useEffect(() => {
    navigation.setOptions({
      headerBlurEffect: 'none',
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="服务器内搜索"
            hitSlop={10}
            onPress={() => router.push('/(tabs)/(servers)/server-search')}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="search" size={18} color={theme.colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收藏"
            hitSlop={10}
            onPress={() => router.push('/(tabs)/(servers)/favorites')}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="heart-outline" size={18} color={theme.colors.text} />
          </Pressable>
        </View>
      ),
      headerShadowVisible: false,
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: theme.colors.text,
      headerTransparent: true,
    });
  }, [navigation, router, theme.colors.text]);

  // Stabilize onViewAll callbacks
  const handleViewAllResume = useCallback(
    () => router.push('/(tabs)/(servers)/view-all/resume'),
    [router],
  );
  const handleViewAllNextup = useCallback(
    () => router.push('/(tabs)/(servers)/view-all/nextup'),
    [router],
  );

  // Build stable onViewAll callbacks for latest sections
  const latestViewAllHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    for (const section of sections) {
      if (section.type === 'latest') {
        const folderId = section.key.replace('latest_', '');
        const folderName = section.title.replace('最近添加的 ', '');
        handlers[section.key] = () =>
          router.push({
            pathname: '/(tabs)/(servers)/view-all/[type]',
            params: { folderId, folderName, type: 'latest' },
          });
      }
    }
    return handlers;
  }, [sections, router]);

  const { backgroundImageInfo, headerImage, headerOverlay } = useCarouselHeaderLayers({
    items: carouselItems,
    height: carouselHeight,
    isFocused,
    isLoading: randomItemsQuery.isLoading,
  });

  if (servers.length === 0 && isInitialized) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <IconSymbol
          name="externaldrive.connected.to.line.below"
          size={48}
          color={theme.colors.textTertiary}
        />
        <ThemedText style={theme.typography.title3}>还没有媒体账号</ThemedText>
        <ThemedText style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          添加 Jellyfin 或 Emby 账号以开始使用
        </ThemedText>
        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radius.md,
              marginTop: theme.spacing.sm,
              paddingHorizontal: theme.spacing.xl,
              paddingVertical: theme.spacing.md,
            },
          ]}
          onPress={() => router.push('/(tabs)/(servers)')}
        >
          <ThemedText
            style={[theme.typography.bodyEmphasized, { color: theme.colors.inverseText }]}
          >
            添加媒体账号
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <HomeAtmosphereScrollView
      backgroundColor={backgroundColor}
      contentStyle={{
        gap: theme.spacing.xs,
        paddingBottom: theme.spacing.lg,
      }}
      headerHeight={carouselHeight}
      headerImage={headerImage}
      headerOverlay={headerOverlay}
      imageInfo={backgroundImageInfo}
      isDark={theme.isDark}
    >
      <View style={[styles.content, { gap: theme.spacing.lg, marginTop: theme.spacing.md }]}>
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
    </HomeAtmosphereScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'relative',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    overflow: 'hidden',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
});
