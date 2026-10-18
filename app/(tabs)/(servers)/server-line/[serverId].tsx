import { HeaderActionProgress } from '@/components/navigation/HeaderActionProgress';
import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import { ServerFormButton } from '@/components/servers/ServerFormButton';
import { ServerFormField, ServerFormSection } from '@/components/servers/ServerFormControls';
import { ServerFormScrollView } from '@/components/servers/ServerFormScrollView';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getServerConnections } from '@/lib/serverConnections';
import { layout, useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Platform, Text } from 'react-native';

type PendingAction = 'save' | 'switch' | 'remove';

function ServerLineScreen() {
  const { serverId, connectionId } = useLocalSearchParams<{
    serverId: string;
    connectionId?: string;
  }>();
  const { getServer, saveConnection, switchConnection, removeConnection } = useMediaServers();
  const server = getServer(serverId);
  const line = server
    ? getServerConnections(server).find((line) => line.id === connectionId)
    : undefined;
  const [name, setName] = useState(line?.name ?? '');
  const [address, setAddress] = useState(line?.address ?? '');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const busy = pending !== null;
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const theme = useAppTheme();
  const router = useRouter();
  const active = !!line && line.address === server?.address;
  const missing = !server || (!!connectionId && !line);
  const run = async (key: PendingAction, action: () => Promise<void>) => {
    if (busyRef.current || missing) return;
    busyRef.current = true;
    setPending(key);
    setError('');
    try {
      await action();
      router.back();
    } catch (error) {
      setError(error instanceof Error ? error.message : '连接失败，请检查地址和网络');
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };
  return (
    <>
      <OuterScreenOptions title={connectionId ? '编辑线路' : '添加线路'} large={false} grouped />
      <HeaderToolbar placement="right">
        {pending === 'save' ? (
          Platform.OS === 'ios' ? (
            <Stack.Toolbar.View>
              <HeaderActionProgress label="正在验证并保存线路" />
            </Stack.Toolbar.View>
          ) : (
            <HeaderActionProgress label="正在验证并保存线路" />
          )
        ) : (
          <HeaderButton
            icon={getNativeToolbarIcon('save', 'checkmark')}
            accessibilityLabel="保存线路"
            disabled={busy || missing || !address.trim()}
            onPress={() =>
              void run('save', () => saveConnection(serverId, name, address, connectionId))
            }
            variant="done"
          >
            保存
          </HeaderButton>
        )}
      </HeaderToolbar>
      <ServerFormScrollView
        maxContentWidth={layout.formMaxWidth}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 24 }}
        style={{ backgroundColor: theme.colors.backgroundGrouped }}
      >
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {missing ? '服务器或线路已不存在，请返回重试。' : `${server.name} · ${server.username}`}
        </Text>
        {!missing ? (
          <ServerFormSection footer="使用同一服务器的完整地址。">
            <ServerFormField
              label="线路名称"
              placeholder="例如：家中 Wi-Fi、外网"
              defaultValue={name}
              onChangeText={setName}
              editable={!busy}
            />
            <ServerFormField
              label="线路地址"
              placeholder="https://media.example.com:8097"
              defaultValue={address}
              onChangeText={setAddress}
              keyboardType="url"
              autoComplete="url"
              textContentType="URL"
              editable={!busy}
            />
          </ServerFormSection>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}
        {line ? (
          <>
            <ServerFormButton
              title={pending === 'switch' ? '正在连接…' : active ? '正在使用此线路' : '使用此线路'}
              variant="text"
              color={theme.colors.tint}
              busy={pending === 'switch'}
              disabled={busy || active}
              onPress={() => void run('switch', () => switchConnection(serverId, line.id))}
            />
            <ServerFormButton
              title={pending === 'remove' ? '正在删除…' : '删除线路'}
              variant="text"
              color={theme.colors.danger}
              busy={pending === 'remove'}
              disabled={busy || active}
              onPress={() =>
                Alert.alert('删除线路？', line.name, [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => void run('remove', () => removeConnection(serverId, line.id)),
                  },
                ])
              }
            />
            {active ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                删除前请先切换到其他线路。
              </Text>
            ) : null}
          </>
        ) : null}
      </ServerFormScrollView>
    </>
  );
}
export default withOuterTheme(ServerLineScreen);
