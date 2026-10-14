import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import PageScrollView from '@/components/PageScrollView';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getServerConnections } from '@/lib/serverConnections';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

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
  const active = line?.address === server?.address;
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
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
  const inputStyle = { color: theme.colors.text, fontSize: 17, padding: 16, minHeight: 54 };
  return (
    <>
      <OuterScreenOptions title={line ? '编辑线路' : '添加线路'} grouped />
      <HeaderToolbar placement="right">
        <HeaderButton
          icon={getNativeToolbarIcon('save', 'checkmark')}
          accessibilityLabel={busy ? '正在验证线路' : '保存线路'}
          disabled={busy || !server || !address.trim()}
          onPress={() => void run(() => saveConnection(serverId, name, address, connectionId))}
        >
          保存
        </HeaderButton>
      </HeaderToolbar>
      <PageScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 20, gap: 20 }}
        style={{ backgroundColor: theme.colors.backgroundGrouped }}
      >
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {server?.name} · {server?.username}
        </Text>
        <View
          style={{ backgroundColor: theme.colors.surface, borderRadius: 12, overflow: 'hidden' }}
        >
          <TextInput
            accessibilityLabel="线路名称"
            placeholder="线路名称，例如局域网、外网"
            placeholderTextColor={theme.colors.textTertiary}
            value={name}
            onChangeText={setName}
            editable={!busy}
            style={inputStyle}
          />
          <View style={{ height: 0.5, marginLeft: 16, backgroundColor: theme.colors.separator }} />
          <TextInput
            accessibilityLabel="线路地址"
            placeholder="https://media.example.com:8097"
            placeholderTextColor={theme.colors.textTertiary}
            value={address}
            onChangeText={setAddress}
            editable={!busy}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="URL"
            style={inputStyle}
          />
        </View>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          填写完整地址，包括端口和路径。线路必须连接到同一台服务器，保存时会检查当前账号是否可用。
        </Text>
        {busy ? <ActivityIndicator color={theme.colors.tint} /> : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}
        {line ? (
          <>
            <Pressable
              disabled={busy || active}
              accessibilityRole="button"
              onPress={() => void run(() => switchConnection(serverId, line.id))}
              style={{
                padding: 16,
                backgroundColor: theme.colors.surface,
                borderRadius: 12,
                opacity: active || busy ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: 17, color: theme.colors.tint, textAlign: 'center' }}>
                {active ? '正在使用此线路' : '使用此线路'}
              </Text>
            </Pressable>
            {!active ? (
              <Pressable
                disabled={busy}
                accessibilityRole="button"
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
                style={{ padding: 16, backgroundColor: theme.colors.surface, borderRadius: 12 }}
              >
                <Text style={{ color: theme.colors.danger, fontSize: 17, textAlign: 'center' }}>
                  删除线路
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </PageScrollView>
    </>
  );
}
export default withOuterTheme(ServerLineScreen);
