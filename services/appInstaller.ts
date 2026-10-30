import { selectAppUpdate, type AppRelease, type InstallerDownload } from '@/lib/appUpdates';
import { t as tr } from '@/lib/i18n';
import { isUpdateSource, type UpdateSource } from '@/lib/updateSources';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { prerelease } from 'semver';

type NativeDownload = Omit<InstallerDownload, 'release'> & { release: string };
type NativeInstaller = {
  supportedUpdateSources?: string[];
  startDownloadAsync: (release: string, automatic: boolean) => Promise<NativeDownload>;
  getDownloadAsync: () => Promise<NativeDownload | null>;
  cancelDownloadAsync: () => Promise<void>;
  setPlaybackActiveAsync: (active: boolean) => Promise<void>;
  isUnmeteredAsync: () => Promise<boolean>;
  prepareInstallAsync: (uri: string) => Promise<string>;
  installApkAsync: (uri: string) => Promise<'opened' | 'permission-required'>;
};
const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeInstaller>('AppInstaller') : null;
// Older binaries receiving JS must keep a usable browser fallback.
export const canInstallAppUpdate = typeof native?.startDownloadAsync === 'function';

export function supportsInstallerSource(source: UpdateSource) {
  return (
    canInstallAppUpdate &&
    (source === 'github' || native?.supportedUpdateSources?.includes(source) === true)
  );
}

export function parseInstallerDownload(value: NativeDownload | null): InstallerDownload | null {
  if (!value) return null;
  try {
    const saved: AppRelease = JSON.parse(value.release);
    const source = saved.source ?? 'github';
    if (!isUpdateSource(source)) return null;
    if (source === 'cnb' && !saved.installer.sha256) return null;
    const selected = selectAppUpdate(
      [
        {
          tag_name: saved.tag,
          draft: false,
          prerelease: !!prerelease(saved.version),
          assets: [
            {
              name: saved.installer.name,
              size: saved.installer.size,
              state: 'uploaded',
              digest: saved.installer.sha256 ? `sha256:${saved.installer.sha256}` : null,
            },
          ],
        },
      ],
      '0.0.0-0',
      'android',
      source,
    );
    if (
      !selected ||
      selected.installer.url !== saved.installer.url ||
      selected.version !== saved.version ||
      !['downloading', 'ready', 'error'].includes(value.status) ||
      !Number.isFinite(value.progress) ||
      (value.status === 'ready' &&
        (typeof value.uri !== 'string' || !value.uri.startsWith('file://')))
    )
      return null;
    return { ...value, release: selected, progress: Math.max(0, Math.min(100, value.progress)) };
  } catch {
    return null;
  }
}

export async function startAppInstallerDownload(release: AppRelease, automatic: boolean) {
  if (!canInstallAppUpdate) throw new Error(tr('updates.backgroundDownloadBuildRequired'));
  const result = parseInstallerDownload(
    await native!.startDownloadAsync(JSON.stringify(release), automatic),
  );
  if (!result) throw new Error(tr('updates.saveDownloadFailed'));
  return result;
}
export async function getAppInstallerDownload() {
  return canInstallAppUpdate ? parseInstallerDownload(await native!.getDownloadAsync()) : null;
}
export async function cancelAppInstallerDownload() {
  if (canInstallAppUpdate) await native!.cancelDownloadAsync();
}
export async function setInstallerPlaybackActive(active: boolean) {
  if (canInstallAppUpdate) await native!.setPlaybackActiveAsync(active);
}
export async function installAppUpdate(uri: string) {
  if (!canInstallAppUpdate) throw new Error(tr('updates.inAppInstallationUnsupported'));
  try {
    await native!.prepareInstallAsync(uri);
    return await native!.installApkAsync(uri);
  } catch {
    throw new Error(tr('updates.prepareInstallerFailed'));
  }
}

export async function isInstallerNetworkUnmetered() {
  return canInstallAppUpdate && (await native!.isUnmeteredAsync());
}
