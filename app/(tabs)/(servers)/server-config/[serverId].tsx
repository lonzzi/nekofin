import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { getHiddenUserViews, toggleUserViewHidden } from '@/lib/utils/userViewConfig';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { serverUserViewsQueryOptions } from '@/services/media/queryOptions';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

function ServerConfigScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { servers, removeServer } = useMediaServers();
  const router = useTracedRouter('server-config');
  const [connection, setConnection] = useState('');
  const [checking, setChecking] = useState(false);

  const server = useMemo(() => servers.find((s) => s.id === serverId), [servers, serverId]);
  const serverAdapter = useMemo(() => {
    if (!server) return null;
    const api = createMediaApiFromServerInfo(server);
    return createMediaAdapterWithApi(server.type, api);
  }, [server]);

  const userViewQuery = useQueryWithFocus({
    ...serverUserViewsQueryOptions({ adapter: serverAdapter, server }),
    refetchOnScreenFocus: 'stale',
  });

  const [hiddenUserViewIds, setHiddenUserViewIds] = useState<string[]>(() =>
    serverId ? getHiddenUserViews(serverId) : [],
  );

  useFocusEffect(
    useCallback(() => {
      if (serverId) {
        setHiddenUserViewIds(getHiddenUserViews(serverId));
      }
    }, [serverId]),
  );

  const handleToggleHidden = (userViewId: string, hidden: boolean) => {
    if (serverId) {
      toggleUserViewHidden(serverId, userViewId, hidden);
      setHiddenUserViewIds(getHiddenUserViews(serverId));
    }
  };

  if (!server) {
    return (
      <>
        <NativeSettingsForm testID="server-config-missing-form">
          <NativeSettingsSection>
            <NativeSettingsItem
              title={<SettingsTitle>服务器不存在</SettingsTitle>}
              subtitle={<SettingsSubtitle primary="这个账号可能已经被删除" />}
            />
          </NativeSettingsSection>
        </NativeSettingsForm>
      </>
    );
  }

  return (
    <>
      <OuterScreenOptions title="服务器设置" />
      <NativeSettingsForm testID="server-config-form">
        <NativeSettingsSection title="连接与账号">
          <NativeSettingsItem
            title={<SettingsTitle>{server.name}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={`${server.type === 'emby' ? 'Emby' : 'Jellyfin'} · ${server.username}`}
              />
            }
          />
          <NativeSettingsItem
            title={<SettingsTitle>服务器地址</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={server.address} lines={3} />}
          />
          <NativeSettingsItem
            title={<SettingsTitle>服务器线路</SettingsTitle>}
            subtitle={
              <SettingsSubtitle primary="局域网与外网地址，可在首页头像菜单中切换" lines={2} />
            }
            disclosure
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(servers)/server-lines/[serverId]',
                params: { serverId: server.id },
              })
            }
          />
          <NativeSettingsItem
            title={<SettingsTitle>{checking ? '正在检查连接…' : '测试连接'}</SettingsTitle>}
            subtitle={connection ? <SettingsSubtitle primary={connection} lines={3} /> : undefined}
            // Keep the native clickable modifier mounted while the request is pending.
            onPress={() => {
              if (checking) return;
              setChecking(true);
              setConnection('');
              void Promise.all([
                serverAdapter!.getSystemInfo(),
                serverAdapter!.getUserInfo({ userId: server.userId }),
              ])
                .then(([system]) =>
                  setConnection(
                    `连接正常 · ${system.serverName || server.name}${system.version ? ` · ${system.version}` : ''}`,
                  ),
                )
                .catch(() => setConnection('连接失败，请检查网络或重新登录。'))
                .finally(() => setChecking(false));
            }}
          />
          <NativeSettingsItem
            title={<SettingsTitle>编辑连接或重新登录</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="更新地址需要重新验证账号" />}
            disclosure
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(servers)/add-server/[serverType]',
                params: { serverType: server.type, serverId: server.id },
              })
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="显示在首页的媒体库">
          {userViewQuery.isPending ? (
            <NativeSettingsItem
              title={<SettingsTitle>正在加载媒体库...</SettingsTitle>}
              subtitle={<SettingsSubtitle primary="正在从当前服务器读取媒体库列表" />}
            />
          ) : userViewQuery.isError ? (
            <NativeSettingsItem
              title={<SettingsTitle>媒体库加载失败</SettingsTitle>}
              subtitle={<SettingsSubtitle primary="点按重试；也可先测试连接或重新登录。" />}
              onPress={() => void userViewQuery.refetch()}
            />
          ) : userViewQuery.data && userViewQuery.data.length > 0 ? (
            userViewQuery.data.map((userView) => {
              const isHidden = hiddenUserViewIds.includes(userView.id);
              return (
                <NativeSettingsSwitch
                  key={userView.id}
                  title={<SettingsTitle>{userView.name || '未知媒体库'}</SettingsTitle>}
                  value={!isHidden}
                  onValueChange={(visible) => handleToggleHidden(userView.id, !visible)}
                />
              );
            })
          ) : (
            <NativeSettingsItem
              title={<SettingsTitle>暂无媒体库</SettingsTitle>}
              subtitle={<SettingsSubtitle primary="当前账号没有可配置的媒体库" />}
            />
          )}
        </NativeSettingsSection>
        <NativeSettingsSection title="此设备">
          <NativeSettingsItem
            title={<SettingsActionTitle>移除此账号</SettingsActionTitle>}
            subtitle={<SettingsSubtitle primary="不会删除服务器上的媒体和账号。" />}
            onPress={() =>
              Alert.alert('移除此账号？', `${server.name} / ${server.username}`, [
                { text: '取消', style: 'cancel' },
                {
                  text: '移除',
                  style: 'destructive',
                  onPress: () => void removeServer(server.id).then(() => router.back()),
                },
              ])
            }
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
export default withOuterTheme(ServerConfigScreen);
