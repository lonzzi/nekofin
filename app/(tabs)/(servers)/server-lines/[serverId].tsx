import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsChoiceList,
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { getConnectionPolicy, getServerConnections } from '@/lib/serverConnections';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { toast } from '@/lib/toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

function ServerLinesScreen() {
  const { t: tr } = useTranslation();
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { getServer, switchConnection, updateServer } = useMediaServers();
  const server = getServer(serverId);
  const router = useRouter();
  const busyRef = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const connections = server ? getServerConnections(server) : [];
  const policy = server ? getConnectionPolicy(server) : null;
  const run = async (key: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(key);
    try {
      await action();
    } catch (error) {
      toast.error(tr('server.connectionUpdateFailed'), {
        description: error instanceof Error ? error.message : tr('server.checkNetworkAndRetry'),
      });
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };
  const editLine = (connectionId?: string) =>
    router.push({
      pathname: '/(tabs)/(servers)/server-line/[serverId]',
      params: { serverId, ...(connectionId ? { connectionId } : {}) },
    });
  return (
    <>
      <OuterScreenOptions title={tr('server.connections')} grouped />
      <HeaderToolbar placement="right">
        <HeaderButton
          icon={getNativeToolbarIcon('add', 'plus')}
          accessibilityLabel={tr('server.addConnection')}
          disabled={!server || !!pending}
          onPress={() => editLine()}
        />
      </HeaderToolbar>
      <NativeSettingsForm>
        {server && policy ? (
          <>
            <NativeSettingsSection
              title={server.name}
              footer={tr('server.manualConnectionSwitchHint')}
            >
              {/* Reset native selection after a failed request to reflect the active connection. */}
              <NativeSettingsChoiceList
                key={pending ? 'pending' : server.address}
                label={tr('server.switchConnection')}
                value={connections.find((line) => line.address === server.address)?.id ?? ''}
                options={connections.map((line) => ({
                  title: line.name,
                  subtitle: line.address,
                  value: line.id,
                }))}
                disabled={!!pending}
                onValueChange={(id) => void run(id, () => switchConnection(serverId, id))}
              />
              {pending ? (
                <NativeSettingsItem
                  title={
                    <SettingsTitle>
                      {pending === 'policy'
                        ? tr('server.savingConnection')
                        : tr('server.connectingTo', {
                            value:
                              connections.find((line) => line.id === pending)?.name ??
                              tr('server.connection'),
                          })}
                    </SettingsTitle>
                  }
                  busy
                />
              ) : null}
            </NativeSettingsSection>
            <NativeSettingsSection
              title={tr('server.automaticConnection')}
              footer={tr('server.automaticConnectionDescription')}
            >
              <NativeSettingsSwitch
                key={connections.length < 2 ? 'single-line' : 'multiple-lines'}
                title={<SettingsTitle>{tr('server.switchAutomatically')}</SettingsTitle>}
                subtitle={
                  connections.length < 2 ? (
                    <SettingsSubtitle primary={tr('server.addConnectionFirst')} />
                  ) : undefined
                }
                value={policy.enabled}
                disabled={connections.length < 2 || !!pending}
                onValueChange={(enabled) =>
                  void run('policy', () =>
                    updateServer(serverId, {
                      connectionPolicy: {
                        ...policy,
                        enabled,
                        localConnectionId:
                          policy.localConnectionId ??
                          connections.find((line) => line.id !== policy.defaultConnectionId)?.id,
                      },
                    }),
                  )
                }
              />
              <NativeSettingsPicker
                disabled={!!pending}
                title={<SettingsTitle>{tr('server.defaultConnection')}</SettingsTitle>}
                value={policy.defaultConnectionId}
                options={connections.map((line) => ({ title: line.name, value: line.id }))}
                onValueChange={(defaultConnectionId) =>
                  void run('policy', () =>
                    updateServer(serverId, {
                      connectionPolicy: {
                        ...policy,
                        defaultConnectionId,
                        localConnectionId:
                          policy.localConnectionId === defaultConnectionId
                            ? policy.defaultConnectionId
                            : policy.localConnectionId,
                      },
                    }),
                  )
                }
              />
              {connections.length > 1 ? (
                <NativeSettingsPicker
                  disabled={!!pending}
                  title={<SettingsTitle>{tr('server.localConnection')}</SettingsTitle>}
                  value={policy.localConnectionId ?? ''}
                  options={[
                    { title: tr('common.choose'), value: '' },
                    ...connections
                      .filter((line) => line.id !== policy.defaultConnectionId)
                      .map((line) => ({ title: line.name, value: line.id })),
                  ]}
                  onValueChange={(localConnectionId) =>
                    void run('policy', () =>
                      updateServer(serverId, {
                        connectionPolicy: {
                          ...policy,
                          localConnectionId: localConnectionId || undefined,
                          enabled: policy.enabled && !!localConnectionId,
                        },
                      }),
                    )
                  }
                />
              ) : null}
            </NativeSettingsSection>
            <NativeSettingsSection title={tr('server.manageConnections')}>
              {connections.map((line) => (
                <NativeSettingsItem
                  key={line.id}
                  title={
                    <SettingsTitle>{tr('common.editName', { name: line.name })}</SettingsTitle>
                  }
                  subtitle={<SettingsSubtitle primary={line.address} lines={2} />}
                  disclosure
                  disabled={!!pending}
                  onPress={() => {
                    if (!busyRef.current) editLine(line.id);
                  }}
                />
              ))}
              <NativeSettingsItem
                title={
                  <SettingsActionTitle tone="accent">
                    {tr('server.addConnection')}
                  </SettingsActionTitle>
                }
                disabled={!!pending}
                onPress={() => {
                  if (!busyRef.current) editLine();
                }}
              />
            </NativeSettingsSection>
          </>
        ) : (
          <NativeSettingsSection>
            <NativeSettingsItem title={<SettingsTitle>{tr('server.notFound')}</SettingsTitle>} />
          </NativeSettingsSection>
        )}
      </NativeSettingsForm>
    </>
  );
}
export default withOuterTheme(ServerLinesScreen);
