import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { ThemePreference, useThemePreference } from '@/lib/contexts/ThemePreferenceContext';
import { usePerformanceMonitor } from '@/lib/performance/PerformanceMonitorContext';
import { usePerformanceDiagnosticsUnlock } from '@/lib/performance/usePerformanceDiagnosticsUnlock';
import Constants from 'expo-constants';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect } from 'react';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { themePreference, setThemePreference } = useThemePreference();
  const { clear, updateSettings } = usePerformanceMonitor();
  const { isUnlocked, registerVersionTap } = usePerformanceDiagnosticsUnlock();
  const router = useTracedRouter('settings');

  useEffect(() => {
    navigation.setOptions({
      headerLargeTitle: true,
    });
  }, [navigation]);

  const handleVersionPress = useCallback(() => {
    const didUnlock = registerVersionTap();
    if (didUnlock) {
      updateSettings({ enabled: false, overlayVisible: false });
      clear();
      router.push('/performance');
    }
  }, [clear, registerVersionTap, router, updateSettings]);

  return (
    <NativeSettingsForm testID="settings-form">
      <NativeSettingsSection title="播放">
        <NativeSettingsItem
          title={<SettingsTitle>转码设置</SettingsTitle>}
          disclosure
          onPress={() => router.push('/transcoding')}
        />
        <NativeSettingsItem
          title={<SettingsTitle>弹幕设置</SettingsTitle>}
          disclosure
          onPress={() => router.push('/danmaku')}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="外观">
        <NativeSettingsPicker
          title={<SettingsTitle>主题</SettingsTitle>}
          value={themePreference}
          options={[
            { title: '系统', value: 'system' },
            { title: '浅色', value: 'light' },
            { title: '暗色', value: 'dark' },
          ]}
          onValueChange={(value) => setThemePreference(value as ThemePreference)}
        />
      </NativeSettingsSection>

      {isUnlocked ? (
        <NativeSettingsSection title="开发诊断">
          <NativeSettingsItem
            title={<SettingsTitle>性能分析</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="Native FPS、CPU、内存、路由和网络 trace" />}
            disclosure
            onPress={() => router.push('/performance')}
          />
        </NativeSettingsSection>
      ) : null}

      <NativeSettingsSection title="关于">
        <NativeSettingsItem
          title={<SettingsTitle>版本信息</SettingsTitle>}
          subtitle={
            <SettingsSubtitle primary={`nekofin v${Constants.expoConfig?.version || '1.0.0'}`} />
          }
          onPress={handleVersionPress}
        />
        <NativeSettingsItem
          title={<SettingsTitle>开源协议</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="MPL-2.0 License" />}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
