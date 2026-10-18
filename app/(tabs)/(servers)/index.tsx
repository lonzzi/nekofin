import {
  HeaderLabel,
  HeaderMenu,
  HeaderMenuAction,
  HeaderToolbar,
} from '@/components/navigation/HeaderToolbar';
import {
  getNativeToolbarIcon,
  getServerMenuIcon,
} from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions, OuterTitle } from '@/components/outer/OuterPrimitives';
import PageScrollView from '@/components/PageScrollView';
import { HomeServerCard } from '@/components/servers/HomeServerCard';
import { ServerTypePicker } from '@/components/servers/ServerTypePicker';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MEDIA_SERVER_TYPE_OPTIONS } from '@/lib/mediaServerTypes';
import { groupServerAccounts } from '@/lib/serverAccounts';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import type { MediaServerInfo, MediaServerType } from '@/services/media/types';
import { useIsFocused } from 'expo-router/react-navigation';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';

function ServersScreen() {
  const theme = useAppTheme();
  const router = useTracedRouter('servers');
  const { servers, activeServers, setHomeServer, currentServer, removeServer, isInitialized } =
    useMediaServers();
  const accountGroups = groupServerAccounts(servers);
  const isFocused = useIsFocused();
  const { width } = useContentDimensions();
  const availableWidth = Math.max(Math.min(width, 840) - theme.spacing.page * 2, 0);
  const columns = Math.max(
    2,
    Math.floor((availableWidth + theme.spacing.md) / (158 + theme.spacing.md)),
  );
  const cardWidth = (availableWidth - (columns - 1) * theme.spacing.md) / columns;
  const androidCardStyle =
    Platform.OS === 'android'
      ? [styles.androidCard, { backgroundColor: theme.colors.surface }]
      : undefined;
  const open = (server: MediaServerInfo) => {
    setHomeServer(server);
    router.navigate('/(tabs)/(home)');
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
  const remove = (server: MediaServerInfo) =>
    Alert.alert('移除此账号', `从 Nekofin 移除 ${server.name} / ${server.username}？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void removeServer(server.id) },
    ]);
  return (
    <>
      <OuterScreenOptions title="服务器" grouped />
      <OuterTitle>服务器</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderMenu accessibilityLabel="添加媒体账号" icon={getNativeToolbarIcon('add', 'plus')}>
          <HeaderLabel>添加服务器</HeaderLabel>
          {MEDIA_SERVER_TYPE_OPTIONS.map(({ type, label }) => (
            <HeaderMenuAction
              key={type}
              onPress={() => add(type)}
              icon={getServerMenuIcon(type)}
              iconRenderingMode="original"
            >
              {label}
            </HeaderMenuAction>
          ))}
        </HeaderMenu>
      </HeaderToolbar>
      {isInitialized && !servers.length ? (
        <ServerTypePicker onSelect={add} />
      ) : (
        <PageScrollView
          style={{ backgroundColor: theme.colors.backgroundGrouped }}
          contentContainerStyle={styles.page}
        >
          {servers.length ? (
            <>
              <View style={styles.servers}>
                <View style={styles.heading}>
                  <Text style={[styles.count, { color: theme.colors.textSecondary }]}>
                    {activeServers.length} 个服务器 · {servers.length} 个账号
                  </Text>
                </View>
                <View style={styles.grid}>
                  {activeServers.map((server) => (
                    <View key={server.id} style={[{ width: cardWidth }, androidCardStyle]}>
                      <HomeServerCard
                        server={server}
                        accountCount={
                          accountGroups.find((group) =>
                            group.some((account) => account.id === server.id),
                          )?.length ?? 1
                        }
                        onAccounts={() =>
                          router.push({
                            pathname: '/(tabs)/(servers)/server-accounts/[serverId]',
                            params: { serverId: server.id },
                          })
                        }
                        isCurrent={currentServer?.id === server.id}
                        isScreenFocused={isFocused}
                        onOpen={() => open(server)}
                        onSettings={() => settings(server)}
                        onRemove={() => remove(server)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <ActivityIndicator color={theme.colors.tint} />
          )}
        </PageScrollView>
      )}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  androidCard: {
    borderRadius: 22,
    elevation: 3,
    shadowColor: '#000000',
  },
});
