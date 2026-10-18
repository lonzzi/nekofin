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
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import { TEMPORARY_FILE_CACHE_KEYS } from '@/lib/cachePolicy';
import { getStoredPerformanceLogBytes } from '@/lib/performance/performanceLogStorage';
import { usePerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import {
  clearPersistedQueryCache,
  formatStorageBytes,
  getPersistedQueryCacheBytes,
} from '@/lib/queryPersistence';
import { useAppTheme } from '@/lib/theme';
import { clearSubtitleCache, SUBTITLE_CACHE_PATH } from '@/services/media/subtitleCache';
import {
  clearSubtitleFontCache,
  SUBTITLE_FONT_CACHE_PATH,
} from '@/services/media/subtitleFontCache';
import { Column, RNHostView } from '@expo/ui';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

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
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const { clear: clearDiagnosticsCache } = usePerformanceMonitorActions();
  const [fileCacheSizes, setFileCacheSizes] = useState<FileCacheSizes>(emptyFileCacheSizes);
  const [revision, setRevision] = useState(0);
  const [measuring, setMeasuring] = useState(true);
  const [clearingTarget, setClearingTarget] = useState<ClearTarget | null>(null);
  const clearingRef = useRef(false);

  const queryCacheBytes = getPersistedQueryCacheBytes();
  const diagnosticBytes = getStoredPerformanceLogBytes();
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
      if (clearingRef.current) return;
      clearingRef.current = true;
      setClearingTarget(target);
      try {
        await action();
      } catch (error) {
        console.warn('Failed to clear cache', target, error);
        Alert.alert('清理失败', error instanceof Error ? error.message : '请稍后再试。');
      } finally {
        clearingRef.current = false;
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
    (bytes: number) => (measuring ? '计算中' : formatStorageBytes(bytes)),
    [measuring],
  );

  const clearingLabel = useCallback(
    (target: ClearTarget) => (clearingTarget === target ? '清理中' : '清理'),
    [clearingTarget],
  );

  return (
    <>
      <OuterTitle>存储管理</OuterTitle>
      <NativeSettingsForm testID="cache-settings-form">
        <NativeSettingsSection title="本机空间">
          <Column style={{ height: 150 }}>
            <RNHostView>
              <View style={{ padding: 8, gap: 14, width: '100%' }}>
                <Text style={{ fontSize: 36, fontWeight: '600', color: theme.colors.text }}>
                  {measuring ? '计算中…' : formatStorageBytes(totalBytes)}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                  已统计的本地文件与缓存
                </Text>
                <View
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
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                  临时数据 {formatStorageBytes(totalBytes - fileCacheSizes.download)} · 本地下载{' '}
                  {formatStorageBytes(fileCacheSizes.download)}
                </Text>
              </View>
            </RNHostView>
          </Column>
        </NativeSettingsSection>
        <NativeSettingsSection title="临时数据">
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
            title={<SettingsTitle>字幕与字体缓存</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.subtitle)} />}
            trailing={<SettingsValue label={clearingLabel('subtitle')} tone="danger" />}
            onPress={() => void clearTarget('subtitle', clearSubtitleFiles)}
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
        </NativeSettingsSection>

        <NativeSettingsSection title="本地内容">
          <NativeSettingsItem
            testID="cache-row-download"
            title={<SettingsTitle>本地下载文件</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={sizeLabel(fileCacheSizes.download)} />}
            trailing={<SettingsValue label={clearingLabel('download')} tone="danger" />}
            onPress={() =>
              Alert.alert(
                '删除本地下载文件？',
                '这些文件不会包含在临时缓存清理中。删除后需要重新下载。',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () =>
                      void clearTarget('download', () => clearCacheUris(cacheUriGroups.download)),
                  },
                ],
              )
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="应用数据">
          <NativeSettingsItem
            testID="cache-row-media"
            title={<SettingsTitle>媒体库缓存</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={formatStorageBytes(queryCacheBytes)}
                secondary="清理后，媒体库页面会重新从服务器加载数据。"
                lines={1}
              />
            }
            trailing={<SettingsValue label={clearingLabel('media')} tone="danger" />}
            onPress={() => void clearTarget('media', clearMediaCache)}
          />
          <NativeSettingsItem
            testID="cache-row-diagnostics"
            title={<SettingsTitle>诊断日志</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={formatStorageBytes(diagnosticBytes)} />}
            trailing={<SettingsValue label={clearingLabel('diagnostics')} tone="danger" />}
            onPress={() => void clearTarget('diagnostics', clearDiagnosticsCache)}
          />
        </NativeSettingsSection>

        <NativeSettingsSection title="总览与清理">
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
                {clearingTarget === 'all' ? '清理中' : '清理临时缓存'}
              </SettingsActionTitle>
            }
            subtitle={<SettingsSubtitle primary="保留本地下载文件、账号与偏好设置。" />}
            onPress={() => void clearTarget('all', clearAllCaches)}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
