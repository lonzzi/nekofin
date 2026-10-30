import { createAppUpdateController, type UpdateSnapshot } from '@/lib/appUpdateController';
import {
  AUTO_DOWNLOAD_UPDATES_KEY,
  isUpdatePromptRoute,
  resolveInstalledRelease,
} from '@/lib/appUpdates';
import { downloadHotUpdate } from '@/lib/hotUpdates';
import { t as tr, useTranslation } from '@/lib/i18n';
import { getIosSourceLink, getIosUpdateSource, type IosUpdateTool } from '@/lib/iosUpdateSources';
import { getNativeReleaseTag, isProductionBuild } from '@/lib/otaConfig';
import { storage } from '@/lib/storage';
import {
  isUpdateSource,
  OTA_SOURCE_PARAMETER,
  resolveUpdateSource,
  UPDATE_SOURCE_KEY,
  UPDATE_SOURCES,
} from '@/lib/updateSources';
import {
  cancelAppInstallerDownload,
  canInstallAppUpdate,
  getAppInstallerDownload,
  installAppUpdate,
  isInstallerNetworkUnmetered,
  setInstallerPlaybackActive,
  startAppInstallerDownload,
  supportsInstallerSource,
} from '@/services/appInstaller';
import { fetchAppUpdate } from '@/services/appUpdates';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Alert, AppState, Linking, PermissionsAndroid, Platform, Share } from 'react-native';

type AppUpdateContextValue = UpdateSnapshot & {
  currentVersion: string | null;
  checkManually: () => Promise<void>;
  downloadRelease: () => Promise<void>;
  installRelease: () => Promise<void>;
  downloadResources: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  setAutoDownloadEnabled: (value: boolean) => void;
  setUpdateSource: (value: string) => void;
  addIosSource: (tool: IosUpdateTool) => Promise<void>;
  shareIosSource: () => void;
  canInstallPackage: boolean;
  resourceVersion: string | null;
};

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  // The controller survives locale changes; its callbacks use the live global translator.
  useTranslation();
  const pathname = usePathname();
  const updates = Updates.useUpdates();
  const pendingResource = useRef(updates.isUpdatePending);
  pendingResource.current = updates.isUpdatePending;
  const [currentVersion] = useState(() =>
    resolveInstalledRelease(
      Application.nativeApplicationVersion,
      // The OTA manifest can replace expoConfig; the channel comes from the native binary.
      getNativeReleaseTag(Updates.channel) ??
        (Updates.isEnabled ? undefined : Constants.expoConfig?.extra?.releaseTag),
    ),
  );
  async function addIosSource(tool: IosUpdateTool) {
    try {
      await Linking.openURL(
        getIosSourceLink(tool, currentVersion, controller.getSnapshot().source),
      );
    } catch {
      Alert.alert(
        tr('updates.openSideloadingAppFailed'),
        tr('about.sourceAppUnsupportedDescription'),
        [
          { text: tr('common.cancel'), style: 'cancel' },
          {
            text: tr('media.shareSourceUrl'),
            onPress: () => {
              void Share.share({
                message: getIosUpdateSource(currentVersion, controller.getSnapshot().source),
              });
            },
          },
        ],
      );
    }
  }
  function openUpdateURL(url: string) {
    if (Platform.OS !== 'ios') return Linking.openURL(url);
    Alert.alert(tr('updates.chooseUpdateMethod'), tr('updates.iosSourceDescription'), [
      {
        text: 'AltStore Classic',
        onPress: () => {
          void addIosSource('altstore');
        },
      },
      {
        text: 'LiveContainer',
        onPress: () => {
          void addIosSource('livecontainer');
        },
      },
      {
        text: tr('updates.downloadFromSource', {
          source: UPDATE_SOURCES[controller.getSnapshot().source].name,
        }),
        onPress: () => {
          void Linking.openURL(url).catch(() =>
            Alert.alert(tr('updates.openUpdatePageFailed'), tr('common.checkNetworkAndRetry')),
          );
        },
      },
      { text: tr('common.cancel'), style: 'cancel' },
    ]);
    return Promise.resolve();
  }
  async function requestDownloadNotifications() {
    if (!canInstallAppUpdate || Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (!granted)
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch {
      /* Notification permission must never block an update download. */
    }
  }
  const [controller] = useState(() =>
    createAppUpdateController({
      currentVersion,
      automaticEnabled:
        !__DEV__ && isProductionBuild(Updates.channel, Constants.expoConfig?.extra?.appVariant),
      storage,
      source: resolveUpdateSource(storage.getString(UPDATE_SOURCE_KEY)),
      autoDownloadEnabled: storage.getBoolean(AUTO_DOWNLOAD_UPDATES_KEY) ?? true,
      canAutoDownloadResources: async () => {
        if (canInstallAppUpdate) return isInstallerNetworkUnmetered();
        const network = await Network.getNetworkStateAsync();
        return (
          !!network.isConnected &&
          (network.type === Network.NetworkStateType.WIFI ||
            network.type === Network.NetworkStateType.ETHERNET)
        );
      },
      fetchUpdate: (source) => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
          return Promise.reject(new Error(tr('updates.nativeAppRequired')));
        }
        return fetchAppUpdate(currentVersion!, Platform.OS, source);
      },
      openURL: openUpdateURL,
      resources:
        !__DEV__ && Updates.isEnabled
          ? {
              check: async (source) => {
                if (pendingResource.current) return true;
                await Updates.setExtraParamAsync(OTA_SOURCE_PARAMETER, source);
                const result = await Updates.checkForUpdateAsync();
                return result.isAvailable || !!result.isRollBackToEmbedded;
              },
              download: async (source) => {
                if (pendingResource.current) return true;
                await Updates.setExtraParamAsync(OTA_SOURCE_PARAMETER, source);
                return (
                  (await downloadHotUpdate({
                    check: Updates.checkForUpdateAsync,
                    fetch: Updates.fetchUpdateAsync,
                  })) === 'pending'
                );
              },
              apply: Updates.reloadAsync,
            }
          : undefined,
      installer: canInstallAppUpdate
        ? {
            supportsSource: supportsInstallerSource,
            start: startAppInstallerDownload,
            refresh: getAppInstallerDownload,
            cancel: cancelAppInstallerDownload,
            install: installAppUpdate,
          }
        : undefined,
      showUpdate: (release, actions) => {
        const installation =
          Platform.OS === 'ios'
            ? tr('updates.iosUpdateDescription')
            : supportsInstallerSource(controller.getSnapshot().source)
              ? tr('updates.androidUpdateDescription')
              : tr('updates.newBuildRequiredDescription');
        Alert.alert(
          tr('updates.versionAvailable', { version: release.version }),
          tr('updates.currentVersionAndInstallation', {
            currentVersion: currentVersion,
            installation: installation,
          }),
          [
            { text: tr('updates.skipVersion'), onPress: actions.ignore },
            { text: tr('updates.remindLater'), style: 'cancel', onPress: actions.later },
            {
              text: supportsInstallerSource(controller.getSnapshot().source)
                ? tr('updates.downloadUpdate')
                : Platform.OS === 'ios'
                  ? tr('updates.chooseUpdateMethod')
                  : tr('updates.openReleasePage'),
              onPress: actions.open,
            },
          ],
          { cancelable: true, onDismiss: actions.later },
        );
      },
      showResourceUpdate: (download, dismiss) =>
        Alert.alert(
          tr('updates.appResourceAvailable'),
          tr('updates.resourceDownloadDescription'),
          [
            { text: tr('common.later'), style: 'cancel', onPress: dismiss },
            { text: tr('updates.downloadUpdate'), onPress: download },
          ],
          { cancelable: true, onDismiss: dismiss },
        ),
      showReady: (kind, install, dismiss) =>
        Alert.alert(
          tr('updates.downloaded'),
          kind === 'package'
            ? tr('updates.installNowConfirmation')
            : tr('updates.reloadNowConfirmation'),
          [
            { text: tr('common.later'), style: 'cancel', onPress: dismiss },
            {
              text: kind === 'package' ? tr('updates.install') : tr('player.reload'),
              onPress: install,
            },
          ],
          { cancelable: true, onDismiss: dismiss },
        ),
      showMessage: (title, message, dismiss) =>
        Alert.alert(title, message, [{ text: tr('common.ok'), onPress: dismiss }], {
          cancelable: true,
          onDismiss: dismiss,
        }),
    }),
  );
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    let revision = 0;
    const playableRoute = !isUpdatePromptRoute(pathname);
    const sync = () => {
      const currentRevision = ++revision;
      clearTimeout(timer);
      clearInterval(polling);
      controller.setCanPrompt(false);
      void setInstallerPlaybackActive(playableRoute).catch(() => {});
      if (AppState.currentState !== 'active' || playableRoute) return;
      // Restore system-owned work before checking releases or scheduling another download.
      void controller.refreshDownload().finally(() => {
        if (disposed || currentRevision !== revision) return;
        timer = setTimeout(() => controller.setCanPrompt(true), 750);
        polling = setInterval(() => void controller.refreshDownload(), 1500);
      });
    };
    sync();
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      disposed = true;
      revision++;
      clearTimeout(timer);
      clearInterval(polling);
      subscription.remove();
      controller.setCanPrompt(false);
    };
  }, [controller, pathname]);

  function setAutoDownloadEnabled(value: boolean) {
    storage.set(AUTO_DOWNLOAD_UPDATES_KEY, value);
    controller.setAutoDownloadEnabled(value);
    if (value) void requestDownloadNotifications();
  }

  return (
    <AppUpdateContext.Provider
      value={{
        ...snapshot,
        currentVersion,
        checkManually: controller.checkManually,
        downloadRelease: async () => {
          await requestDownloadNotifications();
          await controller.downloadRelease();
        },
        installRelease: controller.installRelease,
        downloadResources: controller.downloadResources,
        cancelDownload: controller.cancelDownload,
        setAutoDownloadEnabled,
        setUpdateSource: (value) => {
          if (isUpdateSource(value) && controller.setSource(value)) {
            storage.set(UPDATE_SOURCE_KEY, value);
            void controller.checkAutomatically();
          }
        },
        addIosSource,
        shareIosSource: () => {
          void Share.share({ message: getIosUpdateSource(currentVersion, snapshot.source) });
        },
        canInstallPackage: supportsInstallerSource(snapshot.source),
        resourceVersion: !Updates.isEnabled
          ? null
          : Updates.isEmbeddedLaunch
            ? tr('common.bundled')
            : (Updates.updateId?.slice(0, 8) ?? tr('updates.updated')),
      }}
    >
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate() {
  const context = useContext(AppUpdateContext);
  if (!context) throw new Error('useAppUpdate must be used within AppUpdateProvider');
  return context;
}
