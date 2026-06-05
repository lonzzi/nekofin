import {
  NativeSettingsButton,
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { TextInput } from '@expo/ui';
import { useState } from 'react';
import { Alert } from 'react-native';
import { z } from 'zod';

interface AddServerFormProps {
  onClose: () => void;
}

const addServerSchema = z.object({
  serverType: z.enum(['jellyfin', 'emby']),
  address: z.url('请输入有效的URL').min(1, '请输入服务器地址'),
  username: z.string().min(1, '请输入用户名'),
  password: z.string().optional(),
});

type AddServerFormData = z.infer<typeof addServerSchema>;

export const AddServerForm: React.FC<AddServerFormProps> = ({ onClose }) => {
  const { authenticateAndAddServer } = useMediaServers();
  const [serverType, setServerType] = useState<AddServerFormData['serverType']>('jellyfin');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const result = addServerSchema.safeParse({
      serverType,
      address: address.trim(),
      username: username.trim(),
      password: password.trim(),
    });

    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? '请检查账号信息');
      return;
    }

    setFormError(null);
    setIsLoading(true);
    try {
      await authenticateAndAddServer({
        address: result.data.address,
        username: result.data.username,
        password: result.data.password || '',
        type: result.data.serverType,
      });

      Alert.alert('成功', '媒体账号添加成功', [{ text: '确定', onPress: onClose }]);
    } catch (error) {
      console.error('Authentication error:', error);
      setFormError(
        error instanceof Error ? error.message : '账号认证失败，请检查地址、用户名和密码',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NativeSettingsForm testID="add-media-account-form">
      <NativeSettingsSection title="添加媒体账号">
        <NativeSettingsPicker
          title="媒体后端"
          value={serverType}
          options={[
            { title: 'Jellyfin', value: 'jellyfin' },
            { title: 'Emby', value: 'emby' },
          ]}
          onValueChange={(value) => setServerType(value as AddServerFormData['serverType'])}
          disabled={isLoading}
        />
        <NativeSettingsItem
          title="后端地址"
          subtitle="例如: http://192.168.1.100:8096"
          trailing={
            <TextInput
              defaultValue={address}
              onChangeText={setAddress}
              placeholder="URL"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoComplete="url"
              editable={!isLoading}
            />
          }
        />
        <NativeSettingsItem
          title="用户名"
          trailing={
            <TextInput
              defaultValue={username}
              onChangeText={setUsername}
              placeholder="用户名"
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
              placeholder="密码"
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

      <NativeSettingsSection>
        <NativeSettingsButton
          label={isLoading ? '添加中...' : '添加媒体账号'}
          onPress={handleSubmit}
          disabled={isLoading}
        />
        <NativeSettingsButton label="取消" onPress={onClose} variant="text" disabled={isLoading} />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
};
