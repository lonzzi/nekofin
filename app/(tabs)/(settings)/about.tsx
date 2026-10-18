import { usePlayerLab } from '@/components/dev/player-lab/PlayerLabEntry';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
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
          ? '已是最新版本'
          : status === 'error'
            ? '检查失败，点按重试'
            : '';

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
            disclosure
            onPress={() => void Linking.openURL('https://github.com/lonzzi/nekofin#readme')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>反馈问题</SettingsTitle>}
            disclosure
            onPress={() => void Linking.openURL('https://github.com/lonzzi/nekofin/issues')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title="关于"
          footer={hotUpdate.available ? '获取更新后会重新载入应用。' : undefined}
        >
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
            title={
              <SettingsActionTitle
                tone={hotUpdate.available && !hotUpdate.busy ? 'accent' : 'muted'}
              >
                获取更新
              </SettingsActionTitle>
            }
            subtitle={
              hotUpdate.subtitle ? <SettingsSubtitle primary={hotUpdate.subtitle} /> : undefined
            }
            onPress={() => void hotUpdate.fetchAndApply()}
            disabled={!hotUpdate.available || hotUpdate.busy}
            busy={hotUpdate.busy}
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
                disclosure
                onPress={playerLab.open}
                testID="open-player-lab"
              />
            ) : null}
            {isUnlocked ? (
              <>
                <NativeSettingsItem
                  title={
                    <SettingsActionTitle tone={status === 'checking' ? 'muted' : 'accent'}>
                      检查安装包更新
                    </SettingsActionTitle>
                  }
                  subtitle={
                    updateSubtitle ? <SettingsSubtitle primary={updateSubtitle} /> : undefined
                  }
                  onPress={() => void checkManually()}
                  busy={status === 'checking'}
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
