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
import { useTranslation } from '@/lib/i18n';
import { usePerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import { usePerformanceDiagnosticsUnlock } from '@/lib/performance/usePerformanceDiagnosticsUnlock';
import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';

export default function AboutScreen() {
  const { t: tr } = useTranslation();
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
      ? (update.downloadWaiting ??
        tr('updates.backgroundDownloadProgress', { value: update.downloadProgress ?? 0 }))
      : downloadStatus === 'installing'
        ? tr('updates.openingInstaller')
        : (update.downloadError ??
          update.error ??
          (release
            ? tr('updates.availableVersion', { version: release.version })
            : status === 'checking'
              ? tr('updates.checking')
              : status === 'idle'
                ? tr('updates.notChecked')
                : tr('updates.upToDate')));
  const resourceSubtitle =
    update.resourceError ??
    {
      unavailable: tr('updates.resourceUpdatesUnsupported'),
      idle: tr('updates.notChecked'),
      checking: tr('updates.checking'),
      available: tr('updates.resourceAvailable'),
      current: tr('updates.resourcesUpToDate'),
      downloading: tr('updates.downloadingResources'),
      ready: tr('updates.readyToReload'),
      applying: tr('common.reloading'),
      error: tr('updates.checkFailed'),
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
      <OuterTitle>{tr('about.helpAndAbout')}</OuterTitle>
      <NativeSettingsForm testID="settings-form">
        <NativeSettingsSection title={tr('about.appInformation')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('common.help')}</SettingsTitle>}
            disclosure
            onPress={() => void Linking.openURL('https://github.com/lonzzi/nekofin#readme')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('about.reportIssue')}</SettingsTitle>}
            disclosure
            onPress={() => void Linking.openURL('https://github.com/lonzzi/nekofin/issues')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('about.title')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('media.version')}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={currentVersion ? `nekofin v${currentVersion}` : tr('media.unknownVersion')}
              />
            }
            onPress={handleVersionPress}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('about.openSourceLicense')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="MPL-2.0 License" />}
          />
        </NativeSettingsSection>

        <NativeSettingsSection title={tr('updates.title')}>
          <NativeSettingsItem
            title={
              <SettingsActionTitle tone={busy ? 'muted' : 'accent'}>
                {tr('updates.checkForUpdates')}
              </SettingsActionTitle>
            }
            subtitle={<SettingsSubtitle primary={tr('updates.checkAppAndResources')} />}
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
                    ? tr('updates.installNewVersion')
                    : update.canInstallPackage
                      ? tr('updates.downloadNewVersion')
                      : Platform.OS === 'ios'
                        ? tr('updates.chooseUpdateMethod')
                        : tr('updates.downloadLatestFromGithub')}
                </SettingsActionTitle>
              ) : (
                <SettingsTitle>{tr('updates.appUpdate')}</SettingsTitle>
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
              title={
                <SettingsActionTitle tone="accent">
                  {tr('updates.cancelDownload')}
                </SettingsActionTitle>
              }
              onPress={() => void update.cancelDownload()}
              testID="cancel-app-download"
            />
          ) : null}
          <NativeSettingsItem
            title={
              resourceStatus === 'available' || resourceStatus === 'ready' ? (
                <SettingsActionTitle tone={busy ? 'muted' : 'accent'}>
                  {resourceStatus === 'ready'
                    ? tr('updates.appResources')
                    : tr('updates.downloadResourceUpdate')}
                </SettingsActionTitle>
              ) : (
                <SettingsTitle>{tr('updates.resources')}</SettingsTitle>
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
          title={tr('updates.settings')}
          footer={
            Platform.OS === 'android'
              ? tr('updates.automaticDownloadDescription')
              : tr('updates.iosResourceUpdateDescription')
          }
        >
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('updates.autoDownload')}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={
                  Platform.OS === 'android'
                    ? tr('updates.askToInstallAfterDownload')
                    : tr('updates.autoDownloadResources')
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
                  <SettingsActionTitle tone="accent">
                    {tr('about.addAltstoreSource')}
                  </SettingsActionTitle>
                }
                onPress={() => void update.addIosSource('altstore')}
                testID="add-altstore-source"
              />
              <NativeSettingsItem
                title={
                  <SettingsActionTitle tone="accent">
                    {tr('about.addLivecontainerSource')}
                  </SettingsActionTitle>
                }
                onPress={() => void update.addIosSource('livecontainer')}
                testID="add-livecontainer-source"
              />
              <NativeSettingsItem
                title={
                  <SettingsActionTitle tone="accent">
                    {tr('media.shareSourceUrl')}
                  </SettingsActionTitle>
                }
                onPress={update.shareIosSource}
              />
            </>
          ) : null}
        </NativeSettingsSection>

        {isUnlocked || playerLab.available ? (
          <NativeSettingsSection title={tr('diagnostics.developerDiagnostics')}>
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
                    title={<SettingsTitle>{tr('updates.resourceVersion')}</SettingsTitle>}
                    subtitle={<SettingsSubtitle primary={update.resourceVersion} />}
                    testID="hot-update-version"
                  />
                ) : null}
                <NativeSettingsItem
                  title={<SettingsTitle>{tr('diagnostics.performance')}</SettingsTitle>}
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
