import { createAppUpdateController, type UpdateSnapshot } from '@/lib/appUpdateController';
import {
  AUTO_DOWNLOAD_UPDATES_KEY,
  isUpdatePromptRoute,
  resolveInstalledRelease,
} from '@/lib/appUpdates';
import { downloadHotUpdate } from '@/lib/hotUpdates';
import { getIosSourceLink, getIosUpdateSource, type IosUpdateTool } from '@/lib/iosUpdateSources';
import { getNativeReleaseTag, isProductionBuild } from '@/lib/otaConfig';
import { storage } from '@/lib/storage';
import {
  cancelAppInstallerDownload,
  canInstallAppUpdate,
  getAppInstallerDownload,
  installAppUpdate,
  isInstallerNetworkUnmetered,
  setInstallerPlaybackActive,
  startAppInstallerDownload,
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
  addIosSource: (tool: IosUpdateTool) => Promise<void>;
  shareIosSource: () => void;
  canInstallPackage: boolean;
  resourceVersion: string | null;
};

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
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
      await Linking.openURL(getIosSourceLink(tool, currentVersion));
    } catch {
      Alert.alert('无法打开侧载工具', '请确认已安装支持源的版本，也可分享源地址后手动添加。', [
        { text: '取消', style: 'cancel' },
        {
          text: '分享源地址',
          onPress: () => {
            void Share.share({ message: getIosUpdateSource(currentVersion) });
          },
        },
      ]);
    }
  }
  function openUpdateURL(url: string) {
    if (Platform.OS !== 'ios') return Linking.openURL(url);
    Alert.alert('选择更新方式', '通过已安装的侧载工具打开 NekoFin 源，或从 GitHub 下载 IPA。', [
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
        text: 'GitHub 下载',
        onPress: () => {
          void Linking.openURL(url).catch(() =>
            Alert.alert('无法打开 GitHub', '请检查网络后重试。'),
          );
        },
      },
      { text: '取消', style: 'cancel' },
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
      fetchUpdate: () => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
          return Promise.reject(new Error('请在 iOS 或 Android 应用中检查更新。'));
        }
        return fetchAppUpdate(currentVersion!, Platform.OS);
      },
      openURL: openUpdateURL,
      resources:
        !__DEV__ && Updates.isEnabled
          ? {
              check: async () => {
                if (pendingResource.current) return true;
                const result = await Updates.checkForUpdateAsync();
                return result.isAvailable || !!result.isRollBackToEmbedded;
              },
              download: async () =>
                pendingResource.current ||
                (await downloadHotUpdate({
                  check: Updates.checkForUpdateAsync,
                  fetch: Updates.fetchUpdateAsync,
                })) === 'pending',
              apply: Updates.reloadAsync,
            }
          : undefined,
      installer: canInstallAppUpdate
        ? {
            start: startAppInstallerDownload,
            refresh: getAppInstallerDownload,
            cancel: cancelAppInstallerDownload,
            install: installAppUpdate,
          }
        : undefined,
      showUpdate: (release, actions) => {
        const installation =
          Platform.OS === 'ios'
            ? '可通过 AltStore Classic、LiveContainer 源或 GitHub 更新。'
            : canInstallAppUpdate
              ? '在应用中下载新版 APK，下载完成后可选择是否安装。'
              : '前往发布页面下载新版 APK，安装后可使用应用内下载安装。';
        Alert.alert(
          `发现新版本 v${release.version}`,
          `当前版本：v${currentVersion}\n${installation}`,
          [
            { text: '忽略此版本', onPress: actions.ignore },
            { text: '稍后提醒', style: 'cancel', onPress: actions.later },
            {
              text: canInstallAppUpdate
                ? '下载更新'
                : Platform.OS === 'ios'
                  ? '选择更新方式'
                  : '前往 GitHub',
              onPress: actions.open,
            },
          ],
          { cancelable: true, onDismiss: actions.later },
        );
      },
      showResourceUpdate: (download, dismiss) =>
        Alert.alert(
          '发现资源更新',
          '可在应用中下载，下载完成后可选择是否重新载入。',
          [
            { text: '稍后', style: 'cancel', onPress: dismiss },
            { text: '下载更新', onPress: download },
          ],
          { cancelable: true, onDismiss: dismiss },
        ),
      showReady: (kind, install, dismiss) =>
        Alert.alert(
          '更新已下载',
          kind === 'package' ? '是否现在安装新版本？' : '是否现在重新载入以应用资源更新？',
          [
            { text: '稍后', style: 'cancel', onPress: dismiss },
            { text: kind === 'package' ? '安装' : '重新载入', onPress: install },
          ],
          { cancelable: true, onDismiss: dismiss },
        ),
      showMessage: (title, message, dismiss) =>
        Alert.alert(title, message, [{ text: '好', onPress: dismiss }], {
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
        addIosSource,
        shareIosSource: () => {
          void Share.share({ message: getIosUpdateSource(currentVersion) });
        },
        canInstallPackage: canInstallAppUpdate,
        resourceVersion: !Updates.isEnabled
          ? null
          : Updates.isEmbeddedLaunch
            ? '随安装包提供'
            : (Updates.updateId?.slice(0, 8) ?? '已更新'),
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
