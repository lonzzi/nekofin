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
import { getConnectionPolicy, getServerConnections } from '@/lib/serverConnections';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

function ServerLinesScreen() {
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
      Alert.alert('线路更新失败', error instanceof Error ? error.message : '请检查网络后重试');
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
      <OuterScreenOptions title="服务器线路" grouped />
      <HeaderToolbar placement="right">
        <HeaderButton
          icon={getNativeToolbarIcon('add', 'plus')}
          accessibilityLabel="添加线路"
          disabled={!server || !!pending}
          onPress={() => editLine()}
        />
      </HeaderToolbar>
      <NativeSettingsForm>
        {server && policy ? (
          <>
            <NativeSettingsSection
              title={server.name}
              footer="点按其他线路即可切换，并关闭自动切换。"
            >
              {/* Reset native selection after a failed request to reflect the active connection. */}
              <NativeSettingsChoiceList
                key={pending ? 'pending' : server.address}
                label="切换服务器线路"
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
                        ? '正在保存切换设置…'
                        : `正在连接 ${connections.find((line) => line.id === pending)?.name ?? '线路'}…`}
                    </SettingsTitle>
                  }
                  busy
                />
              ) : null}
            </NativeSettingsSection>
            <NativeSettingsSection
              title="内外网自动切换"
              footer="Wi-Fi 下优先使用局域网，连接失败时回到默认线路。播放时不自动切换。"
            >
              <NativeSettingsSwitch
                key={connections.length < 2 ? 'single-line' : 'multiple-lines'}
                title={<SettingsTitle>自动切换线路</SettingsTitle>}
                subtitle={
                  connections.length < 2 ? (
                    <SettingsSubtitle primary="请先添加另一条线路" />
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
                title={<SettingsTitle>默认线路</SettingsTitle>}
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
                  title={<SettingsTitle>局域网线路</SettingsTitle>}
                  value={policy.localConnectionId ?? ''}
                  options={[
                    { title: '请选择', value: '' },
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
            <NativeSettingsSection title="管理线路">
              {connections.map((line) => (
                <NativeSettingsItem
                  key={line.id}
                  title={<SettingsTitle>{`编辑 ${line.name}`}</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary={line.address} lines={2} />}
                  disclosure
                  disabled={!!pending}
                  onPress={() => {
                    if (!busyRef.current) editLine(line.id);
                  }}
                />
              ))}
              <NativeSettingsItem
                title={<SettingsActionTitle tone="accent">添加线路</SettingsActionTitle>}
                disabled={!!pending}
                onPress={() => {
                  if (!busyRef.current) editLine();
                }}
              />
            </NativeSettingsSection>
          </>
        ) : (
          <NativeSettingsSection>
            <NativeSettingsItem title={<SettingsTitle>服务器不存在</SettingsTitle>} />
          </NativeSettingsSection>
        )}
      </NativeSettingsForm>
    </>
  );
}
export default withOuterTheme(ServerLinesScreen);
