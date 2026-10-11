import { HomeAccountMenu } from '@/components/home/HomeAccountMenu';
import { MediaHomeContent } from '@/components/home/MediaHomeContent';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useAggregateHome } from '@/hooks/useAggregateHome';
import useRefresh from '@/hooks/useRefresh';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function AggregateHomeScreen() {
  const theme = useAppTheme();
  const router = useTracedRouter('aggregate-home');
  const { servers, isInitialized, homeServerId } = useMediaServers();
  const visibleServers = useMemo(
    () => (homeServerId ? servers.filter((server) => server.id === homeServerId) : servers),
    [servers, homeServerId],
  );
  const home = useAggregateHome(visibleServers);
  // Background refetches must not reveal the native pull-to-refresh control.
  const { refreshing, onRefresh } = useRefresh(
    home.refetch,
    visibleServers.map((server) => server.id),
  );
  const toolbar = <HomeAccountMenu />;
  if (!servers.length && isInitialized)
    return (
      <>
        {toolbar}
        <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
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
            onPress={() => router.push('/(tabs)/(servers)')}
            style={{
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.xl,
              paddingVertical: theme.spacing.md,
              marginTop: theme.spacing.sm,
            }}
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
  return (
    <>
      {toolbar}
      <MediaHomeContent
        carouselItems={home.carouselItems}
        isCarouselLoading={home.isCarouselLoading}
        getItemSource={home.getItemSource}
        refreshing={refreshing}
        onRefresh={onRefresh}
        sections={home.sections.map((section) => ({
          ...section,
          onViewAll:
            section.type === 'userview'
              ? undefined
              : () =>
                  router.push({
                    pathname: '/(tabs)/(home)/view-all/[type]',
                    params: {
                      type: section.type!,
                      sectionKey: section.key,
                      serverId: homeServerId || '',
                    },
                  }),
        }))}
        notice={
          home.failedServers.length ? (
            <View
              style={{
                paddingHorizontal: theme.spacing.page,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text
                style={[theme.typography.footnote, { color: theme.colors.textSecondary, flex: 1 }]}
              >
                {home.failedServers.join('、')} 的部分内容暂时无法载入
              </Text>
              <Pressable onPress={() => void home.refetch()} style={{ paddingVertical: 12 }}>
                <Text style={{ color: theme.colors.tint }}>重试</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />
    </>
  );
}
