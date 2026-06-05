import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getHiddenUserViews, toggleUserViewHidden } from '@/lib/utils/userViewConfig';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { serverUserViewsQueryOptions } from '@/services/media/queryOptions';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function ServerConfigScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { servers } = useMediaServers();
  const navigation = useNavigation();

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

  useEffect(() => {
    navigation.setOptions({
      headerTitle: server?.name,
    });
  }, [navigation, server]);

  if (!server) {
    return (
      <NativeSettingsForm testID="server-config-missing-form">
        <NativeSettingsSection>
          <NativeSettingsItem title="服务器不存在" />
        </NativeSettingsSection>
      </NativeSettingsForm>
    );
  }

  return (
    <NativeSettingsForm testID="server-config-form">
      <NativeSettingsSection title="媒体库设置">
        {userViewQuery.isPending ? (
          <NativeSettingsItem title="正在加载媒体库..." />
        ) : userViewQuery.data && userViewQuery.data.length > 0 ? (
          userViewQuery.data.map((userView) => {
            const isHidden = hiddenUserViewIds.includes(userView.id);
            return (
              <NativeSettingsSwitch
                key={userView.id}
                title={userView.name || '未知媒体库'}
                value={!isHidden}
                onValueChange={(visible) => handleToggleHidden(userView.id, !visible)}
              />
            );
          })
        ) : (
          <NativeSettingsItem title="暂无媒体库" />
        )}
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
