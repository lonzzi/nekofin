import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import { ServerFormField, ServerFormSection } from '@/components/servers/ServerFormControls';
import { ServerFormScrollView } from '@/components/servers/ServerFormScrollView';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getServerConnections } from '@/lib/serverConnections';
import { layout, useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Text } from 'react-native';

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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const theme = useAppTheme();
  const router = useRouter();
  const active = !!line && line.address === server?.address;
  const missing = !server || (!!connectionId && !line);
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current || missing) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      router.back();
    } catch (error) {
      setError(error instanceof Error ? error.message : '连接失败，请检查地址和网络');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <OuterScreenOptions title={connectionId ? '编辑线路' : '添加线路'} large={false} grouped />
      <HeaderToolbar placement="right">
        <HeaderButton
          icon={getNativeToolbarIcon('save', 'checkmark')}
          accessibilityLabel={busy ? '正在验证线路' : '保存线路'}
          disabled={busy || missing || !address.trim()}
          onPress={() => void run(() => saveConnection(serverId, name, address, connectionId))}
          variant="done"
        >
          保存
        </HeaderButton>
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
          <ServerFormSection footer="填写同一台服务器的完整地址，包括端口和路径。保存时会验证服务器和当前账号，无需再次输入密码。">
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
        {busy ? <ActivityIndicator color={theme.colors.tint} /> : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}
        {line ? (
          <>
            <Button
              title={active ? '正在使用此线路' : '使用此线路'}
              color={theme.colors.tint}
              disabled={busy || active}
              onPress={() => void run(() => switchConnection(serverId, line.id))}
            />
            <Button
              title="删除线路"
              color={theme.colors.danger}
              disabled={busy || active}
              onPress={() =>
                Alert.alert('删除线路？', line.name, [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => void run(() => removeConnection(serverId, line.id)),
                  },
                ])
              }
            />
            {active ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                正在使用的线路可修改地址；如需删除，请先切换到其他线路。
              </Text>
            ) : null}
          </>
        ) : null}
      </ServerFormScrollView>
    </>
  );
}
export default withOuterTheme(ServerLineScreen);
