import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { groupServerAccounts } from '@/lib/serverAccounts';
import { getConnectionName } from '@/lib/serverConnectionNames';
import { getConnectionPolicy, getServerConnections } from '@/lib/serverConnections';
import { useAppTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { getCachedToolbarAvatar, getToolbarAvatar } from '@/modules/toolbar-avatar';
import type { MediaServerInfo } from '@/services/media/types';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { AccountMenu, AccountMenuAction, AccountToolbar } from './AccountMenu';

// Keep a 4 pt inset between the avatar and the native 44 pt button.
const AVATAR_DIAMETER = 36;

export function HomeAccountMenu({ server: account }: { server?: MediaServerInfo | null }) {
  const { t: tr } = useTranslation();
  const {
    servers,
    activeServers,
    selectServerAccount,
    currentServer,
    homeServerId,
    setHomeServer,
    switchConnection,
    refreshServerInfo,
    updateServer,
  } = useMediaServers();
  const theme = useAppTheme();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
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
  const accounts =
    groupServerAccounts(servers).find((group) => group.some((item) => item.id === server?.id)) ??
    [];
  const policy = server ? getConnectionPolicy(server) : null;
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
              ? tr('server.switchingConnection')
              : tr('home.accountMenuAccessibilityLabel', {
                  value: server?.username || tr('server.user'),
                })
          }
        >
          <AccountMenu inline title={tr('home.view')}>
            <AccountMenuAction
              onPress={() => selectView(null)}
              subtitle={tr('server.viewAll')}
              isOn={homeServerId === null}
            >
              {tr('home.allServers')}
            </AccountMenuAction>
            {activeServers.map((item) => (
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
          <AccountMenuAction
            disabled={!activeServers.length}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(home)/carousel-libraries',
                params: { serverId: account?.id ?? homeServerId ?? '' },
              })
            }
          >
            {tr('home.featuredLibraries')}
          </AccountMenuAction>
          {server ? (
            <AccountMenu title={tr('server.switchAccount')}>
              <AccountMenu inline title={server.name}>
                {accounts.map((item) => (
                  <AccountMenuAction
                    key={item.id}
                    isOn={activeServers.some((active) => active.id === item.id)}
                    onPress={() => {
                      selectServerAccount(item);
                      router.navigate('/(tabs)/(home)');
                    }}
                  >
                    {item.username}
                  </AccountMenuAction>
                ))}
              </AccountMenu>
              <AccountMenuAction
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(servers)/add-server/[serverType]',
                    params: { serverType: server.type, accountServerId: server.id },
                  })
                }
              >
                {tr('server.addAccount')}
              </AccountMenuAction>
              <AccountMenuAction
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(servers)/server-accounts/[serverId]',
                    params: { serverId: server.id },
                  })
                }
              >
                {tr('server.manageAccounts')}
              </AccountMenuAction>
            </AccountMenu>
          ) : null}
          {server ? (
            <AccountMenu title={tr('server.connections')}>
              <AccountMenuAction
                isOn={policy?.enabled}
                subtitle={tr('server.preferVerifiedLocalUrl')}
                onPress={() => {
                  if (!policy?.localConnectionId) {
                    router.push({
                      pathname: '/(tabs)/(servers)/server-lines/[serverId]',
                      params: { serverId: server.id },
                    });
                    return;
                  }
                  void updateServer(server.id, {
                    connectionPolicy: { ...policy, enabled: !policy.enabled },
                  });
                }}
              >
                {tr('server.switchAutomatically')}
              </AccountMenuAction>
              <AccountMenu inline title={server.name}>
                {connections.map((line) => (
                  <AccountMenuAction
                    key={line.id}
                    subtitle={line.address}
                    isOn={line.address === server.address}
                    onPress={() => {
                      if (switchingRef.current) return;
                      switchingRef.current = true;
                      setSwitching(true);
                      void switchConnection(server.id, line.id)
                        .catch((error) =>
                          toast.error(tr('server.connectionSwitchFailed'), {
                            description:
                              error instanceof Error
                                ? error.message
                                : tr('server.checkConnectionUrlAndNetwork'),
                          }),
                        )
                        .finally(() => {
                          switchingRef.current = false;
                          setSwitching(false);
                        });
                    }}
                  >
                    {getConnectionName(line)}
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
                {tr('server.manageConnections')}
              </AccountMenuAction>
            </AccountMenu>
          ) : null}
          <AccountMenuAction onPress={() => router.navigate('/(tabs)/(servers)')}>
            {tr('navigation.servers')}
          </AccountMenuAction>
        </AccountMenu>
      </AccountToolbar>
    </>
  );
}
