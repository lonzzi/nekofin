import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getServerConnections } from '@/lib/serverConnections';
import { useAppTheme } from '@/lib/theme';
import { getCachedToolbarAvatar, getToolbarAvatar } from '@/modules/toolbar-avatar';
import type { MediaServerInfo } from '@/services/media/types';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { AccountMenu, AccountMenuAction, AccountToolbar } from './AccountMenu';

// Keep a 4 pt inset between the avatar and the native 44 pt button.
const AVATAR_DIAMETER = 36;

export function HomeAccountMenu({ server: account }: { server?: MediaServerInfo | null }) {
  const {
    servers,
    currentServer,
    homeServerId,
    setHomeServer,
    switchConnection,
    refreshServerInfo,
  } = useMediaServers();
  const theme = useAppTheme();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [loadedAvatar, setLoadedAvatar] = useState<{ source: string; uri: string } | null>(null);
  const server =
    account ?? servers.find((server) => server.id === homeServerId) ?? currentServer ?? servers[0];
  const serverId = server?.id;
  const address = server?.address;
  const avatar = server?.userAvatar;
  useEffect(() => {
    if (serverId) void refreshServerInfo(serverId).catch(() => {});
  }, [serverId, address, refreshServerInfo]);
  useEffect(() => {
    let active = true;
    if (avatar) {
      void getToolbarAvatar(avatar)
        .then((uri) => {
          if (active) setLoadedAvatar({ source: avatar, uri });
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [avatar]);

  const avatarUri = avatar
    ? (getCachedToolbarAvatar(avatar) ??
      (loadedAvatar?.source === avatar ? loadedAvatar.uri : undefined))
    : undefined;
  const avatarIcon = useMemo(
    () =>
      avatarUri
        ? { uri: avatarUri, width: AVATAR_DIAMETER, height: AVATAR_DIAMETER }
        : Platform.OS === 'android'
          ? require('../../assets/drawables/account.xml')
          : getNativeToolbarIcon('person', 'person'),
    [avatarUri],
  );

  const selectView = (server: MediaServerInfo | null) => {
    setHomeServer(server);
    router.navigate('/(tabs)/(home)');
  };
  const connections = server ? getServerConnections(server) : [];
  return (
    <>
      <Stack.Screen options={{ headerTintColor: theme.colors.text }} />
      <AccountToolbar placement="right">
        <AccountMenu
          icon={avatarIcon}
          iconRenderingMode={avatarUri || Platform.OS === 'android' ? 'original' : 'template'}
          disabled={switching}
          accessibilityLabel={
            switching
              ? '正在切换服务器线路'
              : `${server?.username || '用户'}，切换首页视图和服务器线路`
          }
        >
          <AccountMenu inline title="首页视图">
            <AccountMenuAction
              onPress={() => selectView(null)}
              subtitle="查看所有服务器"
              isOn={homeServerId === null}
            >
              聚合视图
            </AccountMenuAction>
            {servers.map((item) => (
              <AccountMenuAction
                key={item.id}
                onPress={() => selectView(item)}
                subtitle={item.username}
                isOn={homeServerId === item.id}
              >
                {item.name}
              </AccountMenuAction>
            ))}
          </AccountMenu>
          {server ? (
            <AccountMenu title="服务器线路">
              <AccountMenu inline title={server.name}>
                {connections.map((line) => (
                  <AccountMenuAction
                    key={line.id}
                    subtitle={line.address}
                    onPress={() => {
                      setSwitching(true);
                      void switchConnection(server.id, line.id)
                        .catch((error) =>
                          Alert.alert(
                            '线路切换失败',
                            error instanceof Error ? error.message : '请检查线路地址和网络',
                          ),
                        )
                        .finally(() => setSwitching(false));
                    }}
                  >
                    {line.name}
                  </AccountMenuAction>
                ))}
              </AccountMenu>
              <AccountMenuAction
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(servers)/server-lines/[serverId]',
                    params: { serverId: server.id },
                  })
                }
              >
                管理线路
              </AccountMenuAction>
            </AccountMenu>
          ) : null}
          <AccountMenuAction onPress={() => router.navigate('/(tabs)/(servers)')}>
            服务器
          </AccountMenuAction>
        </AccountMenu>
      </AccountToolbar>
    </>
  );
}
