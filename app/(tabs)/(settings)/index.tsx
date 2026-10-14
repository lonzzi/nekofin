import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useThemePreference, type ThemePreference } from '@/lib/contexts/ThemePreferenceContext';

export default function SettingsScreen() {
  const router = useTracedRouter('settings');
  const { themePreference, setThemePreference } = useThemePreference();
  return (
    <>
      <OuterTitle>设置</OuterTitle>
      <NativeSettingsForm testID="settings-form">
        <NativeSettingsSection title="观影体验">
          <NativeSettingsItem
            title={<SettingsTitle>播放与画质</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="方向、默认倍速与转码偏好" />}
            disclosure
            onPress={() => router.push('/playback')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>音频与字幕</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="默认语言与字幕显示" />}
            disclosure
            onPress={() => router.push('/audio')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>弹幕</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="显示效果、速度与内容过滤" />}
            disclosure
            onPress={() => router.push('/danmaku')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="应用">
          <NativeSettingsPicker
            title={<SettingsTitle>外观</SettingsTitle>}
            value={themePreference}
            options={[
              { title: '跟随系统', value: 'system' },
              { title: '浅色', value: 'light' },
              { title: '深色', value: 'dark' },
            ]}
            onValueChange={(value) => setThemePreference(value as ThemePreference)}
          />
          <NativeSettingsItem
            title={<SettingsTitle>存储管理</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="临时缓存与本地文件分开管理" />}
            disclosure
            onPress={() => router.push('/cache')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="支持">
          <NativeSettingsItem
            title={<SettingsTitle>帮助与关于</SettingsTitle>}
            disclosure
            onPress={() => router.push('/about')}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
