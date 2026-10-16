import { NativeSettingsItem } from '@/components/ui/NativeSettings';
import { SettingsSubtitle } from '@/components/ui/SettingsVisual';
import { useAppTheme } from '@/lib/theme';
import type { DanmakuEpisodeSelection } from '@/services/danmaku';
import {
  createDanmakuEpisodeLoader,
  danmakuEpisodeCacheKey,
} from '@/services/danmakuEpisodeLoader';
import { Text as NativeText } from '@expo/ui';
import { onGloballyPositioned } from '@expo/ui/jetpack-compose/modifiers';
import { onAppear, onDisappear } from '@expo/ui/swift-ui/modifiers';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export function DanmakuEpisodeRow({
  entry,
  loader,
  disabled,
  loading,
  sameNumber,
  title,
  onPress,
}: {
  entry: DanmakuEpisodeSelection;
  loader: ReturnType<typeof createDanmakuEpisodeLoader>;
  disabled: boolean;
  loading: boolean;
  sameNumber: boolean;
  title?: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const appear = useCallback(() => setVisible(true), []);
  const disappear = useCallback(() => setVisible(false), []);
  const positionChanged = useCallback(
    ({ y, height }: { y: number; height: number }) => {
      setVisible(y < windowHeight && y + height > 0);
    },
    [windowHeight],
  );
  const metadataCount = entry.episode.commentCount;
  const countProvided =
    metadataCount != null && Number.isFinite(metadataCount) && metadataCount >= 0;
  const { data: count, isError } = useQuery({
    queryKey: ['danmaku-episode-count', danmakuEpisodeCacheKey(entry)],
    queryFn: async ({ signal }) => (await loader.load(entry, signal)).comments.length,
    enabled: visible && !disabled && !countProvided,
    initialData: countProvided ? metadataCount : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: false,
  });
  const subtitle = loading
    ? '正在加载弹幕…'
    : count != null
      ? count.toLocaleString('zh-CN') + ' 条弹幕'
      : isError
        ? '弹幕数量暂不可用'
        : '正在获取弹幕数量…';

  return (
    <NativeSettingsItem
      title={
        <NativeText
          numberOfLines={3}
          textStyle={{ color: theme.colors.text, fontSize: 16, lineHeight: 21 }}
        >
          {title ?? entry.episode.episodeTitle}
        </NativeText>
      }
      subtitle={
        <SettingsSubtitle
          primary={subtitle}
          secondary={sameNumber ? '与当前视频集号相同，请确认季度和前后篇' : undefined}
          lines={2}
        />
      }
      onPress={disabled ? undefined : onPress}
      modifiers={
        Platform.OS === 'ios'
          ? [onAppear(appear), onDisappear(disappear)]
          : Platform.OS === 'android'
            ? [onGloballyPositioned(positionChanged)]
            : undefined
      }
      testID={'player-danmaku-episode-' + entry.source.id + '-' + entry.episode.episodeId}
    />
  );
}
