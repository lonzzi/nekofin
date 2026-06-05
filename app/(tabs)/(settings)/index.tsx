import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { ThemePreference, useThemePreference } from '@/lib/contexts/ThemePreferenceContext';
import Constants from 'expo-constants';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { servers, currentServer } = useMediaServers();
  const { themePreference, setThemePreference } = useThemePreference();
  const router = useRouter();

  useEffect(() => {
    navigation.setOptions({
      headerLargeTitle: true,
    });
  }, [navigation]);

  return (
    <NativeSettingsForm testID="settings-form">
      <NativeSettingsSection title="媒体账号">
        <NativeSettingsItem
          title="账号与后端"
          subtitle={
            currentServer
              ? `${servers.length} 个账号 - 当前为 ${currentServer.username}`
              : `${servers.length} 个账号`
          }
          onPress={() => router.push('/media')}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="播放">
        <NativeSettingsItem title="转码设置" onPress={() => router.push('/transcoding')} />
        <NativeSettingsItem title="弹幕设置" onPress={() => router.push('/danmaku')} />
      </NativeSettingsSection>

      <NativeSettingsSection title="外观">
        <NativeSettingsPicker
          title="主题"
          value={themePreference}
          options={[
            { title: '系统', value: 'system' },
            { title: '浅色', value: 'light' },
            { title: '暗色', value: 'dark' },
          ]}
          onValueChange={(value) => setThemePreference(value as ThemePreference)}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="关于">
        <NativeSettingsItem
          title="版本信息"
          subtitle={`nekofin v${Constants.expoConfig?.version || '1.0.0'}`}
        />
        <NativeSettingsItem title="开源协议" subtitle="MPL-2.0 License" />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
