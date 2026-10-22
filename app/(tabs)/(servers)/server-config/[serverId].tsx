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
import { useTranslation } from '@/lib/i18n';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { getHiddenUserViews, toggleUserViewHidden } from '@/lib/utils/userViewConfig';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { serverUserViewsQueryOptions } from '@/services/media/queryOptions';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

function ServerConfigScreen() {
  const { t: tr } = useTranslation();
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
            <NativeSettingsItem title={<SettingsTitle>{tr('server.notFound')}</SettingsTitle>} />
          </NativeSettingsSection>
        </NativeSettingsForm>
      </>
    );
  }

  return (
    <>
      <OuterScreenOptions title={tr('server.settings')} />
      <NativeSettingsForm testID="server-config-form">
        <NativeSettingsSection title={tr('server.connectionAndAccounts')}>
          <NativeSettingsItem
            title={<SettingsTitle>{server.name}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={`${server.type === 'emby' ? 'Emby' : 'Jellyfin'} · ${server.username}`}
              />
            }
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('server.accounts')}</SettingsTitle>}
            disclosure
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(servers)/server-accounts/[serverId]',
                params: { serverId: server.id },
              })
            }
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('server.url')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={server.address} lines={3} />}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('server.connections')}</SettingsTitle>}
            disclosure
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(servers)/server-lines/[serverId]',
                params: { serverId: server.id },
              })
            }
          />
          <NativeSettingsItem
            title={
              <SettingsActionTitle tone="accent">
                {checking ? tr('server.checkingConnection') : tr('server.testConnection')}
              </SettingsActionTitle>
            }
            busy={checking}
            subtitle={connection ? <SettingsSubtitle primary={connection} lines={3} /> : undefined}
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
                    tr('server.connectedDescription', {
                      value: system.serverName || server.name,
                      value2: system.version ? ` · ${system.version}` : '',
                    }),
                  ),
                )
                .catch(() => setConnection(tr('server.connectionFailedNetworkOrSignIn')))
                .finally(() => setChecking(false));
            }}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('server.editConnectionOrSignIn')}</SettingsTitle>}
            disclosure
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(servers)/add-server/[serverType]',
                params: { serverType: server.type, serverId: server.id },
              })
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('home.visibleLibraries')}>
          {userViewQuery.isPending ? (
            <NativeSettingsItem
              title={<SettingsTitle>{tr('media.loadingLibraries')}</SettingsTitle>}
              busy
            />
          ) : userViewQuery.isError ? (
            <NativeSettingsItem
              title={
                <SettingsActionTitle tone="accent">
                  {tr('media.librariesLoadFailed')}
                </SettingsActionTitle>
              }
              onPress={() => void userViewQuery.refetch()}
            />
          ) : userViewQuery.data && userViewQuery.data.length > 0 ? (
            userViewQuery.data.map((userView) => {
              const isHidden = hiddenUserViewIds.includes(userView.id);
              return (
                <NativeSettingsSwitch
                  key={userView.id}
                  title={
                    <SettingsTitle>{userView.name || tr('media.unknownLibrary')}</SettingsTitle>
                  }
                  value={!isHidden}
                  onValueChange={(visible) => handleToggleHidden(userView.id, !visible)}
                />
              );
            })
          ) : (
            <NativeSettingsItem title={<SettingsTitle>{tr('media.noLibraries')}</SettingsTitle>} />
          )}
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('common.thisDevice')}>
          <NativeSettingsItem
            title={<SettingsActionTitle>{tr('server.removeAccount')}</SettingsActionTitle>}
            onPress={() =>
              Alert.alert(
                tr('server.removeAccountConfirmationTitle'),
                tr('server.removeAccountLocalNote', {
                  name: server.name,
                  username: server.username,
                }),
                [
                  { text: tr('common.cancel'), style: 'cancel' },
                  {
                    text: tr('common.remove'),
                    style: 'destructive',
                    onPress: () => void removeServer(server.id).then(() => router.back()),
                  },
                ],
              )
            }
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
export default withOuterTheme(ServerConfigScreen);
