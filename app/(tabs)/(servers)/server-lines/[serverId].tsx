import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import {
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
              footer="点按地址切换线路。手动选择会关闭自动切换。"
            >
              {connections.map((line) => (
                <NativeSettingsItem
                  key={line.id}
                  title={<SettingsTitle>{line.name}</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary={line.address} lines={2} />}
                  value={
                    pending === line.id
                      ? '正在连接…'
                      : line.address === server.address
                        ? '✓ 当前'
                        : undefined
                  }
                  onPress={() => void run(line.id, () => switchConnection(serverId, line.id))}
                />
              ))}
            </NativeSettingsSection>
            <NativeSettingsSection
              title="内外网自动切换"
              footer="连接 Wi-Fi 后，验证局域网地址可用时优先使用；离开 Wi-Fi 或验证失败时回到默认线路。播放期间暂停自动切换。"
            >
              <NativeSettingsSwitch
                key={connections.length < 2 ? 'single-line' : 'multiple-lines'}
                title={<SettingsTitle>自动切换线路</SettingsTitle>}
                subtitle={
                  <SettingsSubtitle
                    primary={
                      connections.length < 2
                        ? '先添加一条局域网或外网线路'
                        : '无需读取 Wi-Fi 名称或位置'
                    }
                  />
                }
                value={policy.enabled}
                disabled={connections.length < 2}
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
                title={<SettingsTitle>默认线路</SettingsTitle>}
                subtitle={<SettingsSubtitle primary="外网地址，离开局域网时使用" />}
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
                  title={<SettingsTitle>局域网线路</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary="Wi-Fi 下验证后优先使用的地址" />}
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
            <NativeSettingsSection
              title="管理线路"
              footer="所有线路共用这个服务器账号，无需重复登录。添加或修改地址时会验证服务器和账号。"
            >
              {connections.map((line) => (
                <NativeSettingsItem
                  key={line.id}
                  title={<SettingsTitle>{`编辑 ${line.name}`}</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary={line.address} lines={2} />}
                  disclosure
                  onPress={() => {
                    if (!busyRef.current) editLine(line.id);
                  }}
                />
              ))}
              <NativeSettingsItem
                title={<SettingsActionTitle tone="accent">添加线路</SettingsActionTitle>}
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
