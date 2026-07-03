import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import { getStoredPerformanceLogBytes } from '@/lib/performance/performanceLogStorage';
import { usePerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import {
  clearPersistedQueryCache,
  formatStorageBytes,
  getPersistedQueryCacheBytes,
} from '@/lib/queryPersistence';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

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

async function getUriSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return 0;
    if (!info.isDirectory) return info.size;

    const directoryUri = withTrailingSlash(uri);
    const children = await FileSystem.readDirectoryAsync(directoryUri);
    const childSizes = await Promise.all(
      children.map((name) => getUriSize(`${directoryUri}${encodeURIComponent(name)}`)),
    );
    return childSizes.reduce((total, size) => total + size, 0);
  } catch (error) {
    console.warn('Failed to inspect cache directory', uri, error);
    return 0;
  }
}

async function getUrisSize(uris: string[]) {
  const sizes = await Promise.all(uris.map(getUriSize));
  return sizes.reduce((total, size) => total + size, 0);
}

async function clearCacheUris(uris: string[]) {
  await Promise.all(uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
}

async function measureFileCacheSizes(): Promise<FileCacheSizes> {
  const [video, image, subtitle, download, temporary] = await Promise.all([
    getUrisSize(cacheUriGroups.video),
    getUrisSize(cacheUriGroups.image),
    getUrisSize(cacheUriGroups.subtitle),
    getUrisSize(cacheUriGroups.download),
    getUrisSize(cacheUriGroups.temporary),
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
  const queryClient = useQueryClient();
  const { clear: clearDiagnosticsCache } = usePerformanceMonitorActions();
  const [fileCacheSizes, setFileCacheSizes] = useState<FileCacheSizes>(emptyFileCacheSizes);
  const [revision, setRevision] = useState(0);
  const [measuring, setMeasuring] = useState(true);
  const [clearingTarget, setClearingTarget] = useState<ClearTarget | null>(null);

  const queryCacheBytes = useMemo(() => getPersistedQueryCacheBytes(), [revision]);
  const diagnosticBytes = useMemo(() => getStoredPerformanceLogBytes(), [revision]);
  const queryCacheCount = queryClient.getQueryCache().getAll().length;

  useEffect(() => {
    let cancelled = false;

    setMeasuring(true);
    measureFileCacheSizes()
      .then((sizes) => {
        if (!cancelled) {
          setFileCacheSizes(sizes);
        }
      })
      .catch((error) => {
        console.warn('Failed to measure cache sizes', error);
      })
      .finally(() => {
        if (!cancelled) {
          setMeasuring(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const clearTarget = useCallback(
    async (target: ClearTarget, action: () => Promise<void> | void) => {
      setClearingTarget(target);
      try {
        await action();
      } catch (error) {
        console.warn('Failed to clear cache', target, error);
        Alert.alert('清理失败', error instanceof Error ? error.message : '请稍后再试。');
      } finally {
        setClearingTarget(null);
        refresh();
      }
    },
    [refresh],
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

  const clearAllCaches = useCallback(async () => {
    await Promise.all([
      clearCacheUris(cacheUriGroups.video),
      clearImageCache(),
      clearCacheUris(cacheUriGroups.subtitle),
      clearCacheUris(cacheUriGroups.download),
      clearCacheUris(cacheUriGroups.temporary),
    ]);
    clearMediaCache();
    clearDiagnosticsCache();
  }, [clearDiagnosticsCache, clearImageCache, clearMediaCache]);

  const totalBytes =
    fileCacheSizes.video +
    fileCacheSizes.image +
    fileCacheSizes.subtitle +
    fileCacheSizes.download +
    fileCacheSizes.temporary +
    queryCacheBytes +
    diagnosticBytes;

  const sizeLabel = useCallback(
    (bytes: number) => (measuring ? '计算中' : formatStorageBytes(bytes)),
    [measuring],
  );

  const clearingLabel = useCallback(
    (target: ClearTarget) => (clearingTarget === target ? '清理中' : '清理'),
    [clearingTarget],
  );

  return (
    <NativeSettingsForm testID="cache-settings-form">
      <NativeSettingsSection title="缓存项目">
        <NativeSettingsItem
          testID="cache-row-video"
          title={<SettingsTitle>视频缓存</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.video)} />}
          trailing={<SettingsValue label={clearingLabel('video')} tone="danger" />}
          onPress={() => void clearTarget('video', () => clearCacheUris(cacheUriGroups.video))}
        />
        <NativeSettingsItem
          testID="cache-row-image"
          title={<SettingsTitle>图片缓存</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.image)} />}
          trailing={<SettingsValue label={clearingLabel('image')} tone="danger" />}
          onPress={() => void clearTarget('image', clearImageCache)}
        />
        <NativeSettingsItem
          testID="cache-row-subtitle"
          title={<SettingsTitle>字幕缓存</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.subtitle)} />}
          trailing={<SettingsValue label={clearingLabel('subtitle')} tone="danger" />}
          onPress={() =>
            void clearTarget('subtitle', () => clearCacheUris(cacheUriGroups.subtitle))
          }
        />
        <NativeSettingsItem
          testID="cache-row-media"
          title={<SettingsTitle>媒体库缓存</SettingsTitle>}
          subtitle={
            <SettingsSubtitle
              primary={formatStorageBytes(queryCacheBytes)}
              secondary={`${queryCacheCount} 个内存 query，会同时清理离线缓存。`}
              lines={1}
            />
          }
          trailing={<SettingsValue label={clearingLabel('media')} tone="danger" />}
          onPress={() => void clearTarget('media', clearMediaCache)}
        />
        <NativeSettingsItem
          testID="cache-row-download"
          title={<SettingsTitle>下载缓存</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.download)} />}
          trailing={<SettingsValue label={clearingLabel('download')} tone="danger" />}
          onPress={() =>
            void clearTarget('download', () => clearCacheUris(cacheUriGroups.download))
          }
        />
        <NativeSettingsItem
          testID="cache-row-temporary"
          title={<SettingsTitle>临时缓存</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.temporary)} />}
          trailing={<SettingsValue label={clearingLabel('temporary')} tone="danger" />}
          onPress={() =>
            void clearTarget('temporary', () => clearCacheUris(cacheUriGroups.temporary))
          }
        />
        <NativeSettingsItem
          testID="cache-row-diagnostics"
          title={<SettingsTitle>诊断日志</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={formatStorageBytes(diagnosticBytes)} />}
          trailing={<SettingsValue label={clearingLabel('diagnostics')} tone="danger" />}
          onPress={() => void clearTarget('diagnostics', clearDiagnosticsCache)}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="总计">
        <NativeSettingsItem
          title={<SettingsTitle>缓存大小</SettingsTitle>}
          trailing={
            <SettingsValue
              label={measuring ? '计算中' : formatStorageBytes(totalBytes)}
              tone="muted"
            />
          }
        />
        <NativeSettingsItem
          title={
            <SettingsActionTitle>
              {clearingTarget === 'all' ? '清理中' : '一键清理'}
            </SettingsActionTitle>
          }
          onPress={() => void clearTarget('all', clearAllCaches)}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
