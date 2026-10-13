import PageScrollView from '@/components/PageScrollView';
import { ServerTypeIcon } from '@/components/servers/ServerTypeIcon';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { buildConnectionAddress } from '@/lib/serverConnection';
import { useAppTheme } from '@/lib/theme';
import { getMediaAdapter } from '@/services/media';
import type { MediaServerInfo, MediaServerType } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassCard } from './ui/GlassCard';

export interface AddServerFormHandle {
  submit: () => Promise<void>;
}
interface Props {
  existingServer?: MediaServerInfo;
  serverType: MediaServerType;
  onLoadingChange?: (loading: boolean) => void;
  onSuccess?: () => void;
}
const defaultPortByType: Record<MediaServerType, string> = {
  jellyfin: '8096',
  emby: '8096',
};

const serverTitleByType: Record<MediaServerType, string> = {
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useAppTheme();

  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{title}</Text>
      ) : null}
      <GlassCard radius={24}>{children}</GlassCard>
    </View>
  );
}

function FormRow({
  label,
  children,
  showSeparator = true,
}: {
  label: string;
  children: ReactNode;
  showSeparator?: boolean;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.rowOuter}>
      <View style={styles.row}>
        <Text numberOfLines={1} style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
        <View style={styles.inputSlot}>{children}</View>
      </View>
      {showSeparator ? (
        <View style={[styles.separator, { backgroundColor: theme.colors.separator }]} />
      ) : null}
    </View>
  );
}

function FormInput({
  value,
  onChangeText,
  placeholder,
  editable,
  secureTextEntry,
  ...props
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  editable: boolean;
  secureTextEntry?: boolean;
} & Omit<React.ComponentProps<typeof TextInput>, 'style' | 'value' | 'onChangeText'>) {
  const theme = useAppTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textTertiary}
      editable={editable}
      secureTextEntry={secureTextEntry}
      selectionColor={theme.colors.tint}
      underlineColorAndroid="transparent"
      style={[
        styles.input,
        {
          color: theme.colors.text,
          opacity: editable ? 1 : theme.opacity.disabled,
        },
      ]}
      {...props}
    />
  );
}

export const AddServerForm = forwardRef<AddServerFormHandle, Props>(
  ({ serverType, existingServer, onLoadingChange, onSuccess }, ref) => {
    const { authenticateAndAddServer, updateServer } = useMediaServers();
    const type = existingServer?.type ?? serverType;
    const theme = useAppTheme();
    const [address, setAddress] = useState(existingServer?.address ?? '');
    const [port, setPort] = useState('');
    const [path, setPath] = useState('');
    const [username, setUsername] = useState(existingServer?.username ?? '');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(existingServer?.name ?? '');
    const [note, setNote] = useState(existingServer?.note ?? '');
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState('');
    const submit = useCallback(async () => {
      if (busyRef.current) return;
      setError('');
      let resolved: string;
      try {
        resolved = buildConnectionAddress(address, port, path);
      } catch (e) {
        setError(e instanceof Error ? e.message : '请检查地址');
        return;
      }
      if (!username.trim()) {
        setError('请输入用户名');
        return;
      }
      busyRef.current = true;
      setBusy(true);
      onLoadingChange?.(true);
      try {
        const params = {
          address: resolved,
          username: username.trim(),
          password,
          type,
          name: name.trim(),
          note: note.trim(),
        };
        if (existingServer) {
          await getMediaAdapter(type).authenticateAndSaveServer({
            ...params,
            addServer: async (authenticated) => {
              await updateServer(existingServer.id, authenticated);
            },
          });
        } else await authenticateAndAddServer(params);
        setPassword('');
        onSuccess?.();
      } catch {
        setError('连接失败。请检查服务器地址、网络和账号信息，然后重试。');
      } finally {
        busyRef.current = false;
        setBusy(false);
        onLoadingChange?.(false);
      }
    }, [
      address,
      port,
      path,
      username,
      password,
      type,
      name,
      note,
      authenticateAndAddServer,
      existingServer,
      updateServer,
      onSuccess,
      onLoadingChange,
    ]);
    useImperativeHandle(ref, () => ({ submit }), [submit]);
    return (
      <PageScrollView
        testID="add-media-account-form"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.backgroundGrouped }}
        contentContainerStyle={styles.container}
      >
        <GlassCard radius={24} style={styles.identityCard}>
          <View style={[styles.identityIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
            <ServerTypeIcon type={serverType} size={30} />
          </View>
          <View style={styles.identityText}>
            <Text style={[styles.identityTitle, { color: theme.colors.text }]}>
              {serverTitleByType[serverType]} 账号
            </Text>
            <Text style={[styles.identitySubtitle, { color: theme.colors.textSecondary }]}>
              {serverType === 'emby' ? '连接 Emby 媒体服务器' : '连接 Jellyfin 媒体服务器'}
            </Text>
          </View>
        </GlassCard>

        <FormSection>
          <FormRow label="名称">
            <FormInput
              accessibilityLabel="服务器名称"
              value={name}
              onChangeText={setName}
              placeholder="可选"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </FormRow>
          <FormRow label="备注" showSeparator={false}>
            <FormInput
              accessibilityLabel="服务器备注"
              value={note}
              onChangeText={setNote}
              placeholder="可选"
              autoCorrect={false}
              editable={!busy}
            />
          </FormRow>
        </FormSection>

        <FormSection title="服务器地址">
          <FormRow label="地址">
            <FormInput
              accessibilityLabel="服务器地址"
              value={address}
              onChangeText={setAddress}
              placeholder="IP、域名或完整链接"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoComplete="url"
              editable={!busy}
            />
          </FormRow>
          <FormRow label="端口">
            <FormInput
              accessibilityLabel="服务器端口"
              value={port}
              onChangeText={setPort}
              placeholder={`默认 ${defaultPortByType[serverType]}`}
              keyboardType="number-pad"
              editable={!busy}
            />
          </FormRow>
          <FormRow label="路径" showSeparator={false}>
            <FormInput
              accessibilityLabel="服务器路径"
              value={path}
              onChangeText={setPath}
              placeholder="可选，例如 /jellyfin"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </FormRow>
        </FormSection>

        <FormSection title="登录信息">
          <FormRow label="用户">
            <FormInput
              accessibilityLabel="用户名"
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!busy}
            />
          </FormRow>
          <FormRow label="密码" showSeparator={false}>
            <View style={styles.passwordRow}>
              <FormInput
                accessibilityLabel="密码"
                value={password}
                onChangeText={setPassword}
                placeholder="可选"
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!busy}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={visible ? '隐藏密码' : '显示密码'}
                hitSlop={8}
                onPress={() => setVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={visible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.tint}
                />
              </Pressable>
            </View>
          </FormRow>
        </FormSection>

        {error ? (
          <GlassCard
            radius={18}
            style={[
              styles.errorCard,
              {
                borderColor: theme.colors.danger,
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.danger} />
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          </GlassCard>
        ) : null}
      </PageScrollView>
    );
  },
);

AddServerForm.displayName = 'AddServerForm';

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  identityCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  identityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  identityTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  identitySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  rowOuter: {
    minHeight: 58,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 12,
  },
  label: {
    width: 58,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  inputSlot: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 0,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 86,
  },
  passwordRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorCardRim: {
    borderColor: 'rgba(255,255,255,0.48)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.68,
  },
});
