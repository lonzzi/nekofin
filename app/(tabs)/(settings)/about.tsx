import { usePlayerLab } from '@/components/dev/player-lab/PlayerLabEntry';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useAppUpdate } from '@/lib/contexts/AppUpdateContext';
import { usePerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import { usePerformanceDiagnosticsUnlock } from '@/lib/performance/usePerformanceDiagnosticsUnlock';
import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';

export default function AboutScreen() {
  const { updateSettings } = usePerformanceMonitorActions();
  const playerLab = usePlayerLab();
  const { isUnlocked, registerVersionTap } = usePerformanceDiagnosticsUnlock();
  const router = useTracedRouter('settings');
  const update = useAppUpdate();
  const { currentVersion, status, release, resourceStatus, downloadStatus } = update;
  const busy =
    status === 'checking' ||
    downloadStatus === 'downloading' ||
    downloadStatus === 'installing' ||
    resourceStatus === 'downloading' ||
    resourceStatus === 'applying';
  const packageSubtitle =
    downloadStatus === 'downloading'
      ? (update.downloadWaiting ?? `后台下载中 ${update.downloadProgress ?? 0}%`)
      : downloadStatus === 'installing'
        ? '正在打开系统安装器…'
        : (update.downloadError ??
          update.error ??
          (release
            ? `可更新至 v${release.version}`
            : status === 'checking'
              ? '正在检查…'
              : status === 'idle'
                ? '尚未检查'
                : '安装包已是最新版本'));
  const resourceSubtitle =
    update.resourceError ??
    {
      unavailable: '此安装包暂不支持资源更新',
      idle: '尚未检查',
      checking: '正在检查…',
      available: '发现可用的资源更新',
      current: '资源已是最新版本',
      downloading: '正在下载资源更新…',
      ready: '已下载，可重新载入应用',
      applying: '正在重新载入…',
      error: '检查失败，请重试',
    }[resourceStatus];

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
            title={<SettingsTitle>开源协议</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="MPL-2.0 License" />}
          />
        </NativeSettingsSection>

        <NativeSettingsSection title="应用更新">
          <NativeSettingsItem
            title={
              <SettingsActionTitle tone={busy ? 'muted' : 'accent'}>检查更新</SettingsActionTitle>
            }
            subtitle={<SettingsSubtitle primary="同时检查安装包和资源更新" />}
            onPress={() => void update.checkManually()}
            disabled={busy}
            busy={status === 'checking'}
            testID="check-app-update"
          />
          <NativeSettingsItem
            title={
              release ? (
                <SettingsActionTitle tone={busy ? 'muted' : 'accent'}>
                  {downloadStatus === 'ready'
                    ? '安装新版本'
                    : update.canInstallPackage
                      ? '下载新版本'
                      : Platform.OS === 'ios'
                        ? '选择更新方式'
                        : '前往 GitHub 下载新版'}
                </SettingsActionTitle>
              ) : (
                <SettingsTitle>安装包更新</SettingsTitle>
              )
            }
            subtitle={<SettingsSubtitle primary={packageSubtitle} lines={3} />}
            onPress={
              release
                ? () =>
                    void (downloadStatus === 'ready'
                      ? update.installRelease()
                      : update.downloadRelease())
                : undefined
            }
            disabled={busy}
            busy={downloadStatus === 'downloading' || downloadStatus === 'installing'}
            testID="download-app-update"
          />
          {downloadStatus === 'downloading' ? (
            <NativeSettingsItem
              title={<SettingsActionTitle tone="accent">取消下载</SettingsActionTitle>}
              onPress={() => void update.cancelDownload()}
              testID="cancel-app-download"
            />
          ) : null}
          <NativeSettingsItem
            title={
              resourceStatus === 'available' || resourceStatus === 'ready' ? (
                <SettingsActionTitle tone={busy ? 'muted' : 'accent'}>
                  {resourceStatus === 'ready' ? '应用资源更新' : '下载资源更新'}
                </SettingsActionTitle>
              ) : (
                <SettingsTitle>资源更新</SettingsTitle>
              )
            }
            subtitle={<SettingsSubtitle primary={resourceSubtitle} lines={3} />}
            onPress={
              resourceStatus === 'available' || resourceStatus === 'ready'
                ? () => void update.downloadResources()
                : undefined
            }
            disabled={busy}
            busy={resourceStatus === 'downloading' || resourceStatus === 'applying'}
            testID="download-resource-update"
          />
        </NativeSettingsSection>

        <NativeSettingsSection
          title="更新设置"
          footer={
            Platform.OS === 'android'
              ? '自动下载仅使用非计费网络，播放时延后开始下载和安装提醒。手动下载可使用当前网络。'
              : '资源更新会提前下载，应用时再询问。安装包更新由侧载工具完成。'
          }
        >
          <NativeSettingsSwitch
            title={<SettingsTitle>自动下载更新</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={
                  Platform.OS === 'android' ? '下载完成后再提示安装' : '自动下载兼容的资源更新'
                }
              />
            }
            value={update.autoDownloadEnabled}
            onValueChange={update.setAutoDownloadEnabled}
          />
          {Platform.OS === 'ios' ? (
            <>
              <NativeSettingsItem
                title={
                  <SettingsActionTitle tone="accent">添加 AltStore Classic 源</SettingsActionTitle>
                }
                onPress={() => void update.addIosSource('altstore')}
                testID="add-altstore-source"
              />
              <NativeSettingsItem
                title={
                  <SettingsActionTitle tone="accent">添加 LiveContainer 源</SettingsActionTitle>
                }
                onPress={() => void update.addIosSource('livecontainer')}
                testID="add-livecontainer-source"
              />
              <NativeSettingsItem
                title={<SettingsActionTitle tone="accent">分享源地址</SettingsActionTitle>}
                onPress={update.shareIosSource}
              />
            </>
          ) : null}
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
                {update.resourceVersion ? (
                  <NativeSettingsItem
                    title={<SettingsTitle>资源版本</SettingsTitle>}
                    subtitle={<SettingsSubtitle primary={update.resourceVersion} />}
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
