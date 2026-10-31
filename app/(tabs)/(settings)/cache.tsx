import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { settingsLayout } from '@/components/ui/settingsLayout';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import { TEMPORARY_FILE_CACHE_KEYS } from '@/lib/cachePolicy';
import { useTranslation } from '@/lib/i18n';
import { scheduleAfterNavigation } from '@/lib/navigationWork';
import { getStoredPerformanceLogBytes } from '@/lib/performance/performanceLogStorage';
import { usePerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import {
  clearPersistedQueryCache,
  formatStorageBytes,
  getPersistedQueryCacheBytes,
} from '@/lib/queryPersistence';
import { useAppTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { clearSubtitleCache, SUBTITLE_CACHE_PATH } from '@/services/media/subtitleCache';
import {
  clearSubtitleFontCache,
  SUBTITLE_FONT_CACHE_PATH,
} from '@/services/media/subtitleFontCache';
import { Column, Text as NativeText, RNHostView } from '@expo/ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

type FileCacheKey = 'video' | 'image' | 'subtitle' | 'download' | 'temporary';
type ClearTarget = FileCacheKey | 'media' | 'diagnostics' | 'all';

type FileCacheSizes = Record<FileCacheKey, number>;

const emptyFileCacheSizes: FileCacheSizes = {
  video: 0,
  image: 0,
  subtitle: 0,
  download: 0,
  temporary: 0,
};

function joinUri(baseUri: string | null, path: string) {
  if (!baseUri) return null;
  return `${baseUri.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}

function uniqueUris(uris: (string | null)[]) {
  return [...new Set(uris.filter((uri): uri is string => Boolean(uri)))];
}

function withTrailingSlash(uri: string) {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

const cacheUriGroups: Record<FileCacheKey, string[]> = {
  video: uniqueUris([
    joinUri(FileSystem.cacheDirectory, 'nekofin/video/'),
    joinUri(FileSystem.cacheDirectory, 'nekofin/player/'),
    joinUri(FileSystem.cacheDirectory, 'mpv/'),
  ]),
  image: uniqueUris([
    joinUri(FileSystem.cacheDirectory, 'com.hackemist.SDImageCache/'),
    joinUri(FileSystem.cacheDirectory, 'SDImageCache/'),
    joinUri(FileSystem.cacheDirectory, 'image_manager_disk_cache/'),
    joinUri(FileSystem.cacheDirectory, 'expo-image/'),
  ]),
  subtitle: uniqueUris([
    joinUri(FileSystem.cacheDirectory, SUBTITLE_FONT_CACHE_PATH),
    joinUri(FileSystem.cacheDirectory, SUBTITLE_CACHE_PATH),
    joinUri(FileSystem.cacheDirectory, 'player-subtitles/'),
    joinUri(FileSystem.cacheDirectory, 'nekofin/subtitles/'),
    joinUri(FileSystem.documentDirectory, 'nekofin/subtitles/'),
  ]),
  download: uniqueUris([
    joinUri(FileSystem.documentDirectory, 'nekofin/downloads/'),
    joinUri(FileSystem.documentDirectory, 'downloads/'),
    joinUri(FileSystem.cacheDirectory, 'nekofin/downloads/'),
  ]),
  temporary: uniqueUris([
    joinUri(FileSystem.cacheDirectory, 'nekofin/tmp/'),
    joinUri(FileSystem.cacheDirectory, 'nekofin/temp/'),
    joinUri(FileSystem.cacheDirectory, 'tmp/'),
    joinUri(FileSystem.cacheDirectory, 'temp/'),
  ]),
};

async function getUriSize(uri: string, signal: AbortSignal): Promise<number> {
  try {
    if (signal.aborted) return 0;
    const info = await FileSystem.getInfoAsync(uri);
    if (signal.aborted) return 0;
    if (!info.exists) return 0;
    if (!info.isDirectory) return info.size;

    const directoryUri = withTrailingSlash(uri);
    const children = await FileSystem.readDirectoryAsync(directoryUri);
    if (signal.aborted) return 0;
    const childSizes = await Promise.all(
      children.map((name) => getUriSize(`${directoryUri}${encodeURIComponent(name)}`, signal)),
    );
    return childSizes.reduce((total, size) => total + size, 0);
  } catch (error) {
    console.warn('Failed to inspect cache directory', uri, error);
    return 0;
  }
}

async function getUrisSize(uris: string[], signal: AbortSignal) {
  const sizes = await Promise.all(uris.map((uri) => getUriSize(uri, signal)));
  return sizes.reduce((total, size) => total + size, 0);
}

async function clearCacheUris(uris: string[]) {
  await Promise.all(uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
}

async function measureFileCacheSizes(signal: AbortSignal): Promise<FileCacheSizes> {
  const [video, image, subtitle, download, temporary] = await Promise.all([
    getUrisSize(cacheUriGroups.video, signal),
    getUrisSize(cacheUriGroups.image, signal),
    getUrisSize(cacheUriGroups.subtitle, signal),
    getUrisSize(cacheUriGroups.download, signal),
    getUrisSize(cacheUriGroups.temporary, signal),
  ]);

  return {
    video,
    image,
    subtitle,
    download,
    temporary,
  };
}

export default function CacheSettingsScreen() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const { clear: clearDiagnosticsCache } = usePerformanceMonitorActions();
  const [fileCacheSizes, setFileCacheSizes] = useState<FileCacheSizes>(emptyFileCacheSizes);
  const [revision, setRevision] = useState(0);
  const [measuring, setMeasuring] = useState(true);
  const [clearingTarget, setClearingTarget] = useState<ClearTarget | null>(null);
  const clearingRef = useRef(false);
  const focused = useIsFocused();
  const [{ queryCacheBytes, diagnosticBytes }, setStoredCacheSizes] = useState({
    queryCacheBytes: 0,
    diagnosticBytes: 0,
  });

  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();

    setMeasuring(true);
    // Parsing the persisted catalog and walking image directories are optional
    // work. Present the form and finish the native transition before measuring.
    const task = scheduleAfterNavigation(() => {
      const storedSizes = {
        queryCacheBytes: getPersistedQueryCacheBytes(),
        diagnosticBytes: getStoredPerformanceLogBytes(),
      };
      void measureFileCacheSizes(controller.signal)
        .then((sizes) => {
          if (!controller.signal.aborted) {
            setFileCacheSizes(sizes);
            setStoredCacheSizes(storedSizes);
          }
        })
        .catch((error) => {
          console.warn('Failed to measure cache sizes', error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setMeasuring(false);
        });
    });

    return () => {
      controller.abort();
      task.cancel();
    };
  }, [focused, revision]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const clearTarget = useCallback(
    async (target: ClearTarget, action: () => Promise<void> | void) => {
      if (clearingRef.current) return;
      clearingRef.current = true;
      setClearingTarget(target);
      try {
        await action();
        toast.success(tr('cache.cleanupComplete'));
      } catch (error) {
        console.warn('Failed to clear cache', target, error);
        toast.error(tr('cache.cleanupFailed'), {
          description: error instanceof Error ? error.message : tr('common.tryAgainLater'),
        });
      } finally {
        clearingRef.current = false;
        setClearingTarget(null);
        refresh();
      }
    },
    [refresh, tr],
  );

  const clearMediaCache = useCallback(() => {
    queryClient.clear();
    clearPersistedQueryCache();
  }, [queryClient]);

  const clearImageCache = useCallback(async () => {
    await Promise.all([
      Image.clearMemoryCache(),
      Image.clearDiskCache(),
      clearCacheUris(cacheUriGroups.image),
    ]);
  }, []);

  const clearSubtitleFiles = useCallback(async () => {
    await Promise.all([clearSubtitleCache(), clearSubtitleFontCache()]);
    const sharedUri = joinUri(FileSystem.cacheDirectory, SUBTITLE_CACHE_PATH);
    const fontUri = joinUri(FileSystem.cacheDirectory, SUBTITLE_FONT_CACHE_PATH);
    await clearCacheUris(
      cacheUriGroups.subtitle.filter((uri) => uri !== sharedUri && uri !== fontUri),
    );
  }, []);

  const clearAllCaches = useCallback(async () => {
    await Promise.all(
      TEMPORARY_FILE_CACHE_KEYS.map((key) =>
        key === 'image'
          ? clearImageCache()
          : key === 'subtitle'
            ? clearSubtitleFiles()
            : clearCacheUris(cacheUriGroups[key]),
      ),
    );
    clearMediaCache();
    clearDiagnosticsCache();
  }, [clearDiagnosticsCache, clearImageCache, clearMediaCache, clearSubtitleFiles]);

  const totalBytes =
    fileCacheSizes.video +
    fileCacheSizes.image +
    fileCacheSizes.subtitle +
    fileCacheSizes.download +
    fileCacheSizes.temporary +
    queryCacheBytes +
    diagnosticBytes;

  const sizeLabel = useCallback(
    (bytes: number) => (measuring ? tr('cache.calculating') : formatStorageBytes(bytes)),
    [measuring, tr],
  );

  const clearingLabel = useCallback(
    (target: ClearTarget) =>
      target === 'download'
        ? clearingTarget === target
          ? tr('common.deleting')
          : tr('common.delete')
        : clearingTarget === target
          ? tr('cache.cleaning')
          : tr('cache.clear'),
    [clearingTarget, tr],
  );

  return (
    <>
      <OuterTitle>{tr('settings.storage')}</OuterTitle>
      <NativeSettingsForm testID="cache-settings-form">
        <NativeSettingsSection title={tr('cache.onDeviceStorage')}>
          <Column
            spacing={14}
            style={{ padding: Platform.OS === 'android' ? settingsLayout.contentInset : 8 }}
          >
            <NativeText
              textStyle={{ fontSize: 36, fontWeight: '600', color: theme.colors.text }}
              modifiers={
                Platform.OS === 'ios'
                  ? [font({ textStyle: 'largeTitle', weight: 'semibold' })]
                  : undefined
              }
            >
              {measuring ? tr('cache.calculatingProgress') : formatStorageBytes(totalBytes)}
            </NativeText>
            <NativeText
              textStyle={{ color: theme.colors.textSecondary, fontSize: 14 }}
              modifiers={Platform.OS === 'ios' ? [font({ textStyle: 'footnote' })] : undefined}
            >
              {tr('cache.measuredStorageDescription')}
            </NativeText>
            <RNHostView matchContents={{ vertical: true }}>
              <View
                accessible={false}
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.surfaceMuted,
                  flexDirection: 'row',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    flex: Math.max(totalBytes - fileCacheSizes.download, 0),
                    backgroundColor: theme.colors.tint,
                  }}
                />
                <View
                  style={{
                    flex: fileCacheSizes.download,
                    backgroundColor: theme.colors.textSecondary,
                  }}
                />
              </View>
            </RNHostView>
            <NativeText
              textStyle={{ fontSize: 12, color: theme.colors.textSecondary }}
              modifiers={Platform.OS === 'ios' ? [font({ textStyle: 'footnote' })] : undefined}
            >
              {tr('cache.storageSummary', {
                size: formatStorageBytes(totalBytes - fileCacheSizes.download),
                size2: formatStorageBytes(fileCacheSizes.download),
              })}
            </NativeText>
          </Column>
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('cache.temporaryData')}>
          <NativeSettingsItem
            testID="cache-row-video"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'video'}
            title={<SettingsTitle>{tr('cache.video')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.video)} />}
            trailing={<SettingsValue label={clearingLabel('video')} tone="danger" />}
            onPress={() => void clearTarget('video', () => clearCacheUris(cacheUriGroups.video))}
          />
          <NativeSettingsItem
            testID="cache-row-image"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'image'}
            title={<SettingsTitle>{tr('cache.images')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.image)} />}
            trailing={<SettingsValue label={clearingLabel('image')} tone="danger" />}
            onPress={() => void clearTarget('image', clearImageCache)}
          />
          <NativeSettingsItem
            testID="cache-row-subtitle"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'subtitle'}
            title={<SettingsTitle>{tr('cache.subtitlesAndFonts')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.subtitle)} />}
            trailing={<SettingsValue label={clearingLabel('subtitle')} tone="danger" />}
            onPress={() => void clearTarget('subtitle', clearSubtitleFiles)}
          />
          <NativeSettingsItem
            testID="cache-row-temporary"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'temporary'}
            title={<SettingsTitle>{tr('cache.temporaryCache')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.temporary)} />}
            trailing={<SettingsValue label={clearingLabel('temporary')} tone="danger" />}
            onPress={() =>
              void clearTarget('temporary', () => clearCacheUris(cacheUriGroups.temporary))
            }
          />
        </NativeSettingsSection>

        <NativeSettingsSection title={tr('cache.localContent')}>
          <NativeSettingsItem
            testID="cache-row-download"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'download'}
            title={<SettingsTitle>{tr('cache.downloadedFiles')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.download)} />}
            trailing={<SettingsValue label={clearingLabel('download')} tone="danger" />}
            onPress={() =>
              Alert.alert(
                tr('cache.deleteDownloadsConfirmation'),
                tr('cache.downloadedFilesDescription'),
                [
                  { text: tr('common.cancel'), style: 'cancel' },
                  {
                    text: tr('common.delete'),
                    style: 'destructive',
                    onPress: () =>
                      void clearTarget('download', () => clearCacheUris(cacheUriGroups.download)),
                  },
                ],
              )
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('cache.appData')}>
          <NativeSettingsItem
            testID="cache-row-media"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'media'}
            title={<SettingsTitle>{tr('cache.libraries')}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={sizeLabel(queryCacheBytes)}
                secondary={tr('cache.libraryReloadDescription')}
              />
            }
            trailing={<SettingsValue label={clearingLabel('media')} tone="danger" />}
            onPress={() => void clearTarget('media', clearMediaCache)}
          />
          <NativeSettingsItem
            testID="cache-row-diagnostics"
            disabled={!!clearingTarget}
            busy={clearingTarget === 'diagnostics'}
            title={<SettingsTitle>{tr('diagnostics.logs')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(diagnosticBytes)} />}
            trailing={<SettingsValue label={clearingLabel('diagnostics')} tone="danger" />}
            onPress={() => void clearTarget('diagnostics', clearDiagnosticsCache)}
          />
        </NativeSettingsSection>

        <NativeSettingsSection title={tr('cache.overviewAndCleanup')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('cache.totalLocalData')}</SettingsTitle>}
            trailing={
              <SettingsValue
                label={measuring ? tr('cache.calculating') : formatStorageBytes(totalBytes)}
                tone="muted"
              />
            }
          />
          <NativeSettingsItem
            disabled={!!clearingTarget}
            busy={clearingTarget === 'all'}
            title={
              <SettingsActionTitle>
                {clearingTarget === 'all' ? tr('cache.cleaning') : tr('cache.clearTemporary')}
              </SettingsActionTitle>
            }
            subtitle={<SettingsSubtitle primary={tr('cache.preserveDownloadsDescription')} />}
            onPress={() => void clearTarget('all', clearAllCaches)}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
