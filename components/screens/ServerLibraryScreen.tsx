import { HomeAccountMenu } from '@/components/home/HomeAccountMenu';
import { MediaHomeContent } from '@/components/home/MediaHomeContent';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

export default function HomeScreen() {
  const { servers, currentServer, isInitialized } = useMediaServers();
  const theme = useAppTheme();

  const router = useTracedRouter('server-library');

  const { sections, randomItemsQuery } = useHomeSections(currentServer);

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

  const toolbar = <HomeAccountMenu server={currentServer} />;

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
      <MediaHomeContent
        carouselItems={carouselItems}
        isCarouselLoading={randomItemsQuery.isLoading}
        sections={sections.map((section) => ({
          ...section,
          onViewAll:
            section.type === 'resume'
              ? handleViewAllResume
              : section.type === 'nextup'
                ? handleViewAllNextup
                : latestViewAllHandlers[section.key],
        }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
