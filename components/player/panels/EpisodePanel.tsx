import { ItemImage } from '@/components/ItemImage';
import { getImagePreferenceOptions } from '@/components/media/cardHelpers';
import { NativeSettingsItem } from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsSymbol, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import { formatDurationFromTicks } from '@/lib/utils';
import type { MediaItem } from '@/services/media/types';
import { List as NativeList, Text as NativeText } from '@expo/ui';
import {
  ContentUnavailableView,
  LazyVStack,
  List as SwiftList,
  ScrollView as SwiftScrollView,
  Section as SwiftSection,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityLabel,
  backgroundOverlay,
  clipShape,
  frame,
  id as nativeID,
  onAppear,
  onDisappear,
  padding,
  scrollPosition,
  scrollTargetLayout,
} from '@expo/ui/swift-ui/modifiers';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export type EpisodePanelProps = {
  episodes: readonly MediaItem[];
  currentItemId?: string | null;
  onSelectEpisode: (episodeId: string) => void;
};

type EpisodeRowModel = {
  id: string;
  title: string;
  metadata: string;
  overview?: string;
  imageUrl?: string;
  blurhash?: string;
};

const imageOptions = getImagePreferenceOptions(ImageType.Thumb);
const supportsNativeScrollPosition =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 17;

type EpisodeNativeRowProps = EpisodeRowModel & {
  current: boolean;
  onSelectEpisode: (episodeId: string) => void;
};

const EpisodeNativeRow = memo(function EpisodeNativeRow({
  id,
  title,
  metadata,
  overview,
  imageUrl,
  blurhash,
  current,
  onSelectEpisode,
}: EpisodeNativeRowProps) {
  const theme = useAppTheme();
  const [artworkVisible, setArtworkVisible] = useState(Platform.OS !== 'ios');
  const handlePress = useCallback(() => onSelectEpisode(id), [id, onSelectEpisode]);
  const handleArtworkAppear = useCallback(() => setArtworkVisible(true), []);
  const handleArtworkDisappear = useCallback(() => setArtworkVisible(false), []);
  const rowLabel = [title, metadata, current ? '正在播放' : null].filter(Boolean).join('，');
  const modifiers =
    Platform.OS === 'ios'
      ? [
          nativeID(id),
          frame({ maxWidth: Infinity, minHeight: 76, alignment: 'leading' }),
          padding({ horizontal: 10, vertical: 8 }),
          backgroundOverlay({ color: current ? theme.colors.surfaceMuted : 'transparent' }),
          clipShape('roundedRectangle', 15),
          accessibilityElement('combine'),
          accessibilityLabel(rowLabel),
          ...(current ? [accessibilityAddTraits(['isSelected'])] : []),
          onAppear(handleArtworkAppear),
          onDisappear(handleArtworkDisappear),
        ]
      : undefined;
  const supportingText =
    metadata || overview ? (
      <>
        {metadata ? (
          <NativeText
            numberOfLines={1}
            textStyle={{
              color: theme.colors.textSecondary,
              fontSize: 12,
              fontWeight: '500',
              lineHeight: 15,
            }}
          >
            {metadata}
          </NativeText>
        ) : null}
        {overview ? (
          <NativeText
            numberOfLines={1}
            textStyle={{
              color: theme.colors.textTertiary,
              fontSize: 11,
              fontWeight: '400',
              lineHeight: 14,
            }}
          >
            {overview}
          </NativeText>
        ) : null}
      </>
    ) : undefined;

  return (
    <NativeSettingsItem
      leading={
        <View pointerEvents="none" style={styles.thumbnailFrame}>
          {!imageUrl || artworkVisible ? (
            <ItemImage
              cachePolicy="disk"
              contentFit="cover"
              placeholderBlurhash={blurhash}
              recyclingKey={id}
              style={styles.thumbnail}
              transition={120}
              uri={imageUrl}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons color={theme.colors.textTertiary} name="film-outline" size={28} />
            </View>
          )}
          {current ? (
            <View style={styles.playingBadge}>
              <Ionicons color="#111318" name="play" size={12} />
            </View>
          ) : null}
        </View>
      }
      title={
        <NativeText
          numberOfLines={2}
          textStyle={{
            color: theme.colors.text,
            fontSize: 14,
            fontWeight: '600',
            lineHeight: 18,
          }}
        >
          {title}
        </NativeText>
      }
      subtitle={supportingText}
      trailing={current ? <SettingsSymbol name="speaker.wave.2.fill" tone="muted" /> : undefined}
      disclosure={!current}
      onPress={current ? undefined : handlePress}
      modifiers={modifiers}
      testID={`player-episode-${id}`}
    />
  );
});

function EpisodeEmptyState() {
  if (supportsNativeScrollPosition) {
    return (
      <ContentUnavailableView
        description="播放器还没有拿到当前季度的剧集数据"
        modifiers={[frame({ maxHeight: Infinity, maxWidth: Infinity })]}
        systemImage="rectangle.stack"
        title="暂无可用剧集"
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <SwiftList testID="player-episode-panel">
        <SwiftSection title="剧集">
          <NativeSettingsItem
            title={<SettingsTitle>暂无可用剧集</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="播放器还没有拿到当前季度的剧集数据" />}
          />
        </SwiftSection>
      </SwiftList>
    );
  }

  return (
    <NativeList testID="player-episode-panel">
      <NativeSettingsItem
        title={<SettingsTitle>暂无可用剧集</SettingsTitle>}
        subtitle={<SettingsSubtitle primary="播放器还没有拿到当前季度的剧集数据" />}
      />
    </NativeList>
  );
}

export function EpisodePanel({ episodes, currentItemId, onSelectEpisode }: EpisodePanelProps) {
  const mediaAdapter = useMediaAdapter();
  const rows = useMemo<EpisodeRowModel[]>(
    () =>
      episodes.map((episode) => {
        const seasonEpisode = [
          episode.parentIndexNumber != null ? `S${episode.parentIndexNumber}` : null,
          episode.indexNumber != null ? `E${episode.indexNumber}` : null,
        ]
          .filter(Boolean)
          .join(' ');
        const duration = episode.runTimeTicks
          ? formatDurationFromTicks(episode.runTimeTicks)
          : null;
        const imageInfo = mediaAdapter.getImageInfo({ item: episode, opts: imageOptions });

        return {
          id: episode.id,
          title: episode.name,
          metadata: [seasonEpisode, duration].filter(Boolean).join(' · '),
          overview: episode.overview?.trim() || undefined,
          imageUrl: imageInfo.url,
          blurhash: imageInfo.blurhash,
        };
      }),
    [episodes, mediaAdapter],
  );
  const initialTargetId = rows.some((row) => row.id === currentItemId) ? currentItemId : null;
  const scrollTarget = useNativeState<string | null>(initialTargetId ?? null);
  const handlePanelAppear = useCallback(() => {
    if (initialTargetId) scrollTarget.set(initialTargetId);
  }, [initialTargetId, scrollTarget]);

  useEffect(() => {
    if (Platform.OS === 'ios' && initialTargetId) scrollTarget.set(initialTargetId);
  }, [initialTargetId, scrollTarget]);

  if (rows.length === 0) return <EpisodeEmptyState />;

  const rowNodes = rows.map((row) => (
    <EpisodeNativeRow
      key={row.id}
      blurhash={row.blurhash}
      current={row.id === currentItemId}
      id={row.id}
      imageUrl={row.imageUrl}
      metadata={row.metadata}
      onSelectEpisode={onSelectEpisode}
      overview={row.overview}
      title={row.title}
    />
  ));

  if (supportsNativeScrollPosition) {
    return (
      <SwiftScrollView
        modifiers={[
          frame({ maxHeight: Infinity, maxWidth: Infinity }),
          scrollPosition(scrollTarget, { anchor: 'center' }),
          onAppear(handlePanelAppear),
        ]}
        showsIndicators={false}
        testID="player-episode-panel"
      >
        <LazyVStack
          alignment="leading"
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            padding({ top: 8, bottom: 16, horizontal: 10 }),
            scrollTargetLayout(),
          ]}
          spacing={2}
        >
          {rowNodes}
        </LazyVStack>
      </SwiftScrollView>
    );
  }

  if (Platform.OS === 'ios') {
    const currentIndex = rows.findIndex((row) => row.id === currentItemId);
    const currentRowNode = currentIndex >= 0 ? rowNodes[currentIndex] : null;
    const remainingRowNodes = rowNodes.filter((_, index) => index !== currentIndex);

    return (
      <SwiftList testID="player-episode-panel">
        {currentRowNode ? <SwiftSection title="正在播放">{currentRowNode}</SwiftSection> : null}
        <SwiftSection title={currentRowNode ? '全部剧集' : undefined}>
          {remainingRowNodes}
        </SwiftSection>
      </SwiftList>
    );
  }

  return <NativeList testID="player-episode-panel">{rowNodes}</NativeList>;
}

const styles = StyleSheet.create({
  thumbnailFrame: {
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderCurve: 'continuous',
    borderRadius: 10,
    height: 63,
    overflow: 'hidden',
    width: 112,
  },
  thumbnail: {
    height: '100%',
    width: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  playingBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    bottom: 6,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    width: 24,
  },
});
