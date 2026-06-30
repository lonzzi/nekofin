import PageScrollView from '@/components/PageScrollView';
import { ServerTypeIcon } from '@/components/servers/ServerTypeIcon';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerType } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useCallback, useImperativeHandle, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { GlassCard } from './ui/GlassCard';

export interface AddServerFormHandle {
  submit: () => Promise<void>;
}

interface AddServerFormProps {
  serverType: MediaServerType;
  onLoadingChange?: (isLoading: boolean) => void;
  onSuccess?: () => void;
}

const addServerSchema = z.object({
  name: z.string().optional(),
  note: z.string().optional(),
  address: z.string().min(1, '请输入服务器地址'),
  path: z.string().optional(),
  port: z
    .string()
    .regex(/^\d{1,5}$/, '请输入有效端口')
    .optional()
    .or(z.literal('')),
  username: z.string().min(1, '请输入用户名'),
  password: z.string().optional(),
});

type AddServerFormData = z.infer<typeof addServerSchema>;

const defaultPortByType: Record<MediaServerType, string> = {
  jellyfin: '8096',
  emby: '8096',
};

const serverTitleByType: Record<MediaServerType, string> = {
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

function normalizeHost(host: string) {
  return host
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function normalizePath(path: string | undefined) {
  const trimmed = path?.trim().replace(/^\/+/, '').replace(/\/+$/, '') ?? '';
  return trimmed ? `/${trimmed}` : '';
}

function buildServerAddress({
  address,
  path,
  port,
  defaultPort,
}: {
  address: string;
  path?: string;
  port?: string;
  defaultPort: string;
}) {
  try {
    const rawAddress = address.trim();
    const addressWithProtocol = /^https?:\/\//i.test(rawAddress)
      ? rawAddress
      : `http://${rawAddress}`;
    const parsedAddress = new URL(addressWithProtocol);
    const protocol = parsedAddress.protocol.replace(':', '');
    const parsedPath = parsedAddress.pathname === '/' ? '' : parsedAddress.pathname;
    const normalizedHost = normalizeHost(parsedAddress.hostname);
    const normalizedPath = normalizePath(path?.trim() || parsedPath);
    const normalizedPort = port?.trim() || parsedAddress.port || defaultPort;

    return `${protocol}://${normalizedHost}${normalizedPort ? `:${normalizedPort}` : ''}${normalizedPath}`;
  } catch {
    throw new Error('服务器地址格式不正确');
  }
}

function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useAppTheme();

  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{title}</Text>
      ) : null}
      <GlassCard radius={24} style={styles.sectionCard}>
        {children}
      </GlassCard>
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

export const AddServerForm = forwardRef<AddServerFormHandle, AddServerFormProps>(
  ({ serverType, onLoadingChange, onSuccess }, ref) => {
    const { authenticateAndAddServer } = useMediaServers();
    const theme = useAppTheme();
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const [address, setAddress] = useState('');
    const [path, setPath] = useState('');
    const [port, setPort] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const setLoading = useCallback(
      (nextLoading: boolean) => {
        setIsLoading(nextLoading);
        onLoadingChange?.(nextLoading);
      },
      [onLoadingChange],
    );

    const handleSubmit = useCallback(async () => {
      const result = addServerSchema.safeParse({
        name: name.trim(),
        note: note.trim(),
        address: address.trim(),
        path: path.trim(),
        port: port.trim(),
        username: username.trim(),
        password: password.trim(),
      } satisfies AddServerFormData);

      if (!result.success) {
        setFormError(result.error.issues[0]?.message ?? '请检查服务器信息');
        return;
      }

      setFormError(null);
      setLoading(true);
      try {
        await authenticateAndAddServer({
          address: buildServerAddress({
            address: result.data.address,
            path: result.data.path,
            port: result.data.port,
            defaultPort: defaultPortByType[serverType],
          }),
          username: result.data.username,
          password: result.data.password || '',
          type: serverType,
          name: result.data.name,
          note: result.data.note,
        });

        Alert.alert('成功', '媒体账号添加成功', [{ text: '确定', onPress: onSuccess }]);
      } catch (error) {
        console.error('Authentication error:', error);
        setFormError(
          error instanceof Error ? error.message : '账号认证失败，请检查地址、用户名和密码',
        );
      } finally {
        setLoading(false);
      }
    }, [
      address,
      authenticateAndAddServer,
      name,
      note,
      onSuccess,
      password,
      path,
      port,
      serverType,
      setLoading,
      username,
    ]);

    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit]);

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
              value={name}
              onChangeText={setName}
              placeholder="可选"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </FormRow>
          <FormRow label="备注" showSeparator={false}>
            <FormInput
              value={note}
              onChangeText={setNote}
              placeholder="可选"
              autoCorrect={false}
              editable={!isLoading}
            />
          </FormRow>
        </FormSection>

        <FormSection title="服务器地址">
          <FormRow label="地址">
            <FormInput
              value={address}
              onChangeText={setAddress}
              placeholder="IP、域名或完整链接"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoComplete="url"
              editable={!isLoading}
            />
          </FormRow>
          <FormRow label="端口">
            <FormInput
              value={port}
              onChangeText={setPort}
              placeholder={`默认 ${defaultPortByType[serverType]}`}
              keyboardType="number-pad"
              editable={!isLoading}
            />
          </FormRow>
          <FormRow label="路径" showSeparator={false}>
            <FormInput
              value={path}
              onChangeText={setPath}
              placeholder="可选，例如 /jellyfin"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </FormRow>
        </FormSection>

        <FormSection title="登录信息">
          <FormRow label="用户">
            <FormInput
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!isLoading}
            />
          </FormRow>
          <FormRow label="密码" showSeparator={false}>
            <View style={styles.passwordRow}>
              <FormInput
                value={password}
                onChangeText={setPassword}
                placeholder="可选"
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!isLoading}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isPasswordVisible ? '隐藏密码' : '显示密码'}
                hitSlop={8}
                onPress={() => setIsPasswordVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.tint}
                />
              </Pressable>
            </View>
          </FormRow>
        </FormSection>

        {formError ? (
          <GlassCard
            radius={18}
            style={[
              styles.errorCard,
              {
                borderColor: theme.colors.danger,
              },
            ]}
            rimStyle={styles.errorCardRim}
          >
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.danger} />
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{formError}</Text>
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
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.58)',
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
