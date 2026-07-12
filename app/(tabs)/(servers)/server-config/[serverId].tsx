import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getHiddenUserViews, toggleUserViewHidden } from '@/lib/utils/userViewConfig';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { serverUserViewsQueryOptions } from '@/services/media/queryOptions';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

export default function ServerConfigScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { servers } = useMediaServers();

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
        <Stack.Title>服务器配置</Stack.Title>
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
      <Stack.Title>{server.name}</Stack.Title>
      <NativeSettingsForm testID="server-config-form">
        <NativeSettingsSection title="媒体库设置">
          {userViewQuery.isPending ? (
            <NativeSettingsItem
              title={<SettingsTitle>正在加载媒体库...</SettingsTitle>}
              subtitle={<SettingsSubtitle primary="正在从当前服务器读取媒体库列表" />}
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
      </NativeSettingsForm>
    </>
  );
}
