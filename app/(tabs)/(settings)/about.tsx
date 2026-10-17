import { usePlayerLab } from '@/components/dev/player-lab/PlayerLabEntry';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useHotUpdate } from '@/hooks/useHotUpdate';
import { useAppUpdate } from '@/lib/contexts/AppUpdateContext';
import { usePerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import { usePerformanceDiagnosticsUnlock } from '@/lib/performance/usePerformanceDiagnosticsUnlock';
import { useCallback } from 'react';
import { Linking } from 'react-native';

export default function AboutScreen() {
  const { updateSettings } = usePerformanceMonitorActions();
  const playerLab = usePlayerLab();
  const { isUnlocked, registerVersionTap } = usePerformanceDiagnosticsUnlock();
  const router = useTracedRouter('settings');
  const { currentVersion, status, release, checkManually } = useAppUpdate();
  const hotUpdate = useHotUpdate();
  const updateSubtitle =
    status === 'checking'
      ? '正在检查新版本…'
      : status === 'available' && release
        ? `发现新版本 v${release.version}`
        : status === 'current'
          ? '当前没有可用的新版本'
          : status === 'error'
            ? '检查失败，点按重试'
            : '查看是否有可用的新版本';

  const handleVersionPress = useCallback(() => {
    const didUnlock = registerVersionTap();
    if (didUnlock) {
      updateSettings({ enabled: false, overlayVisible: false });
      router.push('/performance');
    }
  }, [registerVersionTap, router, updateSettings]);

  return (
    <>
      <OuterTitle>帮助与关于</OuterTitle>
      <NativeSettingsForm testID="settings-form">
        <NativeSettingsSection title="应用信息">
          <NativeSettingsItem
            title={<SettingsTitle>使用帮助</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="服务器连接、播放与弹幕常见问题" />}
            disclosure
            onPress={() => void Linking.openURL('https://github.com/lonzzi/nekofin#readme')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>反馈问题</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="查看已有问题或提交使用反馈" />}
            disclosure
            onPress={() => void Linking.openURL('https://github.com/lonzzi/nekofin/issues')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="关于">
          <NativeSettingsItem
            title={<SettingsTitle>版本信息</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={currentVersion ? `nekofin v${currentVersion}` : '版本未知'}
              />
            }
            onPress={handleVersionPress}
          />
          <NativeSettingsItem
            title={<SettingsTitle>获取更新</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={hotUpdate.subtitle} />}
            onPress={
              hotUpdate.available && !hotUpdate.busy
                ? () => void hotUpdate.fetchAndApply()
                : undefined
            }
            testID="check-hot-update"
          />
          <NativeSettingsItem
            title={<SettingsTitle>开源协议</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="MPL-2.0 License" />}
          />
        </NativeSettingsSection>

        {isUnlocked || playerLab.available ? (
          <NativeSettingsSection title="开发诊断">
            {playerLab.available ? (
              <NativeSettingsItem
                title={<SettingsTitle>Player Lab</SettingsTitle>}
                subtitle={<SettingsSubtitle primary="播放器预览和弹幕压力测试" />}
                disclosure
                onPress={playerLab.open}
                testID="open-player-lab"
              />
            ) : null}
            {isUnlocked ? (
              <>
                <NativeSettingsItem
                  title={<SettingsTitle>检查安装包更新</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary={updateSubtitle} />}
                  onPress={status === 'checking' ? undefined : () => void checkManually()}
                  testID="check-app-update"
                />
                {hotUpdate.resourceVersion ? (
                  <NativeSettingsItem
                    title={<SettingsTitle>资源版本</SettingsTitle>}
                    subtitle={<SettingsSubtitle primary={hotUpdate.resourceVersion} />}
                    testID="hot-update-version"
                  />
                ) : null}
                <NativeSettingsItem
                  title={<SettingsTitle>性能分析</SettingsTitle>}
                  subtitle={<SettingsSubtitle primary="FPS、内存、路由和请求状态" />}
                  disclosure
                  onPress={() => router.push('/performance')}
                />
              </>
            ) : null}
          </NativeSettingsSection>
        ) : null}
      </NativeSettingsForm>
    </>
  );
}
