import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import type { MediaServerType } from '@/services/media/types';
import { TextInput } from '@expo/ui';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Alert } from 'react-native';
import { z } from 'zod';

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

export const AddServerForm = forwardRef<AddServerFormHandle, AddServerFormProps>(
  ({ serverType, onLoadingChange, onSuccess }, ref) => {
    const { authenticateAndAddServer } = useMediaServers();
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const [address, setAddress] = useState('');
    const [path, setPath] = useState('');
    const [port, setPort] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const setLoading = (nextLoading: boolean) => {
      setIsLoading(nextLoading);
      onLoadingChange?.(nextLoading);
    };

    const handleSubmit = async () => {
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
    };

    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit]);

    return (
      <NativeSettingsForm testID="add-media-account-form">
        <NativeSettingsSection>
          <NativeSettingsItem
            title="名称"
            trailing={
              <TextInput
                defaultValue={name}
                onChangeText={setName}
                placeholder="可选"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            }
          />
          <NativeSettingsItem
            title="备注"
            trailing={
              <TextInput
                defaultValue={note}
                onChangeText={setNote}
                placeholder="可选"
                autoCorrect={false}
                editable={!isLoading}
              />
            }
          />
        </NativeSettingsSection>

        <NativeSettingsSection title="服务器地址">
          <NativeSettingsItem
            title="地址"
            trailing={
              <TextInput
                defaultValue={address}
                onChangeText={setAddress}
                placeholder="IP、域名或完整链接"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoComplete="url"
                editable={!isLoading}
              />
            }
          />
          <NativeSettingsItem
            title="端口"
            trailing={
              <TextInput
                defaultValue={port}
                onChangeText={setPort}
                placeholder={`默认 ${defaultPortByType[serverType]}`}
                keyboardType="number-pad"
                editable={!isLoading}
              />
            }
          />
          <NativeSettingsItem
            title="路径"
            trailing={
              <TextInput
                defaultValue={path}
                onChangeText={setPath}
                placeholder="可选，例如 /jellyfin"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            }
          />
        </NativeSettingsSection>

        <NativeSettingsSection title="登录信息">
          <NativeSettingsItem
            title="用户"
            trailing={
              <TextInput
                defaultValue={username}
                onChangeText={setUsername}
                placeholder="必填"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                editable={!isLoading}
              />
            }
          />
          <NativeSettingsItem
            title="密码"
            trailing={
              <TextInput
                defaultValue={password}
                onChangeText={setPassword}
                placeholder="可选"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!isLoading}
              />
            }
          />
        </NativeSettingsSection>

        {formError ? (
          <NativeSettingsSection>
            <NativeSettingsItem title="错误" subtitle={formError} />
          </NativeSettingsSection>
        ) : null}
      </NativeSettingsForm>
    );
  },
);

AddServerForm.displayName = 'AddServerForm';
