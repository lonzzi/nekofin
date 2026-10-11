import {
  getNativeToolbarIcon,
  getServerMenuIcon,
} from '@/components/navigation/nativeToolbarIcons';
import {
  ActionButton,
  EditorialHeading,
  OuterScreenOptions,
  OuterTitle,
} from '@/components/outer/OuterPrimitives';
import PageScrollView from '@/components/PageScrollView';
import { HomeServerCard } from '@/components/servers/HomeServerCard';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaServerSources } from '@/hooks/useMediaServerSources';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import type { MediaServerInfo, MediaServerType } from '@/services/media/types';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

function ServersScreen() {
  const theme = useAppTheme();
  const router = useTracedRouter('servers');
  const { servers, setCurrentServer, isInitialized } = useMediaServers();
  const sources = useMediaServerSources(servers);
  const open = (server: MediaServerInfo) => {
    setCurrentServer(server);
    router.push('/(tabs)/(servers)/library');
  };
  const settings = (server: MediaServerInfo) =>
    router.push({
      pathname: '/(tabs)/(servers)/server-config/[serverId]',
      params: { serverId: server.id },
    });
  const add = (serverType: MediaServerType) =>
    router.push({
      pathname: '/(tabs)/(servers)/add-server/[serverType]',
      params: { serverType },
    });
  return (
    <>
      <OuterScreenOptions title="服务器" />
      <OuterTitle>服务器</OuterTitle>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel="添加媒体账号"
          icon={getNativeToolbarIcon('add', 'plus')}
        >
          <Stack.Toolbar.Label>添加服务器</Stack.Toolbar.Label>
          <Stack.Toolbar.MenuAction
            onPress={() => add('jellyfin')}
            icon={getServerMenuIcon('jellyfin')}
            iconRenderingMode="original"
          >
            Jellyfin
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            onPress={() => add('emby')}
            icon={getServerMenuIcon('emby')}
            iconRenderingMode="original"
          >
            Emby
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <PageScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.page}
      >
        {servers.length ? (
          <>
            <View style={styles.servers}>
              <View style={styles.heading}>
                <Text style={[styles.count, { color: theme.colors.textSecondary }]}>
                  已连接 {servers.length} 个账号
                </Text>
              </View>
              <View style={styles.grid}>
                {sources.map(({ server, adapter }) => (
                  <HomeServerCard
                    key={server.id}
                    server={server}
                    adapter={adapter}
                    single={servers.length === 1}
                    onOpen={() => open(server)}
                    onSettings={() => settings(server)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : isInitialized ? (
          <View style={styles.empty}>
            <EditorialHeading
              title="尚未添加服务器"
              description="连接服务器，在这里汇集你的电影与剧集。"
            />
            <ActionButton label="连接 Jellyfin" onPress={() => add('jellyfin')} />
            <ActionButton label="连接 Emby" secondary onPress={() => add('emby')} />
          </View>
        ) : (
          <ActivityIndicator color={theme.colors.tint} />
        )}
      </PageScrollView>
    </>
  );
}
export default withOuterTheme(ServersScreen);
const styles = StyleSheet.create({
  page: {
    gap: 28,
    paddingTop: 8,
    paddingBottom: 40,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  servers: { paddingHorizontal: 20, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  count: { fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  empty: { padding: 20, gap: 14 },
});
