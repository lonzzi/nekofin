import { useCarouselHeaderLayers } from '@/components/home/CarouselHeader';
import { HomeAtmosphereScrollView } from '@/components/home/HomeAtmosphereScrollView';
import { Section } from '@/components/media/Section';
import { NATIVE_HEADER_ACTIONS } from '@/components/navigation/nativeHeaderModel';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UserViewSection } from '@/components/user-view/UserViewSection';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import { Stack } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const { servers, currentServer, isInitialized } = useMediaServers();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const carouselHeight = useMediaHeroHeight();

  const router = useTracedRouter('server-library');

  const { sections, randomItemsQuery } = useHomeSections(currentServer);
  const isFocused = useIsFocused();

  const carouselItems = useMemo(() => {
    return randomItemsQuery.data ?? [];
  }, [randomItemsQuery.data]);

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

  const toolbar = (
    <>
      <Stack.Screen options={{ headerTintColor: theme.colors.text }} />
      <Stack.Toolbar placement="right">
        {NATIVE_HEADER_ACTIONS.serverLibrary.map((action) => (
          <Stack.Toolbar.Button
            key={action.key}
            accessibilityLabel={action.label}
            icon={getNativeToolbarIcon(action.androidDrawable, action.iosIcon)}
            onPress={() => router.push(action.route)}
            tintColor={theme.colors.text}
          >
            {action.label}
          </Stack.Toolbar.Button>
        ))}
      </Stack.Toolbar>
    </>
  );

  if (servers.length === 0 && isInitialized) {
    return (
      <>
        {toolbar}
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
      </>
    );
  }

  return (
    <>
      {toolbar}
      <HomeAtmosphereScrollView
        backgroundColor={backgroundColor}
        contentStyle={{
          gap: theme.spacing.xs,
          paddingBottom: theme.spacing.lg,
        }}
        headerFadeMode="mask"
        headerHeight={carouselHeight}
        headerImage={headerImage}
        headerOverlay={headerOverlay}
        imageInfo={backgroundImageInfo}
        isDark={theme.isDark}
        optimizeAtmosphereImageLoading
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
    </>
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
});
