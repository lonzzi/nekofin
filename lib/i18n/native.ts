import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { t, type TranslationKey } from './index';

// Persisted by Android so download notifications also translate after JS exits.
const installerMessages = [
  'updates.installationFileInvalid',
  'updates.installationFileMissing',
  'updates.downloadIncomplete',
  'updates.installerChecksumInvalid',
  'updates.installerInvalid',
  'updates.downloadingUnmeteredOnly',
  'updates.downloading',
  'updates.saveDownloadTaskFailed',
  'updates.downloadTaskExpired',
  'updates.installerIncompleteOrInvalid',
  'updates.downloadFailedRetry',
  'updates.waitingForUnmeteredNetwork',
  'updates.waitingForNetwork',
  'updates.taskExpired',
  'updates.title',
  'updates.installReminderDescription',
  'updates.downloadedNotificationTitle',
  'updates.downloadedNotificationDescription',
  'updates.returnToAppToInstall',
] as const satisfies readonly TranslationKey[];

export function syncNativeTranslations() {
  if (Platform.OS !== 'android') return;
  const installer = requireOptionalNativeModule<{
    setLocalizedStrings?: (json: string) => void;
  }>('AppInstaller');
  installer?.setLocalizedStrings?.(
    JSON.stringify(Object.fromEntries(installerMessages.map((key) => [key, t(key)]))),
  );
}
