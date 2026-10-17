import { createAppUpdateController, type UpdateSnapshot } from '@/lib/appUpdateController';
import { isUpdatePromptRoute, resolveInstalledRelease } from '@/lib/appUpdates';
import { getNativeReleaseTag, isProductionBuild } from '@/lib/otaConfig';
import { storage } from '@/lib/storage';
import { fetchAppUpdate } from '@/services/appUpdates';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

type AppUpdateContextValue = UpdateSnapshot & {
  currentVersion: string | null;
  checkManually: () => Promise<void>;
};

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [currentVersion] = useState(() =>
    resolveInstalledRelease(
      Application.nativeApplicationVersion,
      // The OTA manifest can replace expoConfig; the channel comes from the native binary.
      getNativeReleaseTag(Updates.channel) ??
        (Updates.isEnabled ? undefined : Constants.expoConfig?.extra?.releaseTag),
    ),
  );
  const [controller] = useState(() =>
    createAppUpdateController({
      currentVersion,
      automaticEnabled:
        !__DEV__ && isProductionBuild(Updates.channel, Constants.expoConfig?.extra?.appVariant),
      storage,
      fetchUpdate: () => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
          return Promise.reject(new Error('请在 iOS 或 Android 应用中检查更新。'));
        }
        return fetchAppUpdate(currentVersion!, Platform.OS);
      },
      openURL: Linking.openURL,
      showUpdate: (release, actions) => {
        const installation =
          Platform.OS === 'ios'
            ? '前往发布页面下载 IPA，签名后安装。'
            : '前往发布页面下载并安装新版 APK。';
        Alert.alert(
          `发现新版本 v${release.version}`,
          `当前版本：v${currentVersion}\n${installation}`,
          [
            { text: '忽略此版本', onPress: actions.ignore },
            { text: '稍后提醒', style: 'cancel', onPress: actions.later },
            { text: '前往更新', onPress: actions.open },
          ],
          { cancelable: true, onDismiss: actions.later },
        );
      },
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
    const sync = () => {
      clearTimeout(timer);
      controller.setCanPrompt(false);
      if (AppState.currentState === 'active' && isUpdatePromptRoute(pathname)) {
        // Wait for the foreground/navigation transition to settle before presenting native UI.
        timer = setTimeout(() => controller.setCanPrompt(true), 750);
      }
    };
    sync();
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      clearTimeout(timer);
      subscription.remove();
      controller.setCanPrompt(false);
    };
  }, [controller, pathname]);

  return (
    <AppUpdateContext.Provider
      value={{ ...snapshot, currentVersion, checkManually: controller.checkManually }}
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
