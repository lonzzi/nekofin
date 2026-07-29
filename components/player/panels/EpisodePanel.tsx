import { ItemImage } from '@/components/ItemImage';
import { getImagePreferenceOptions } from '@/components/media/cardHelpers';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { formatDurationFromTicks } from '@/lib/utils';
import type { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';

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

type EpisodeRowProps = EpisodeRowModel & {
  isCurrent: boolean;
  onSelect: (episodeId: string) => void;
};

const ROW_HEIGHT = 92;
const imageOptions = getImagePreferenceOptions(ImageType.Thumb);

const EpisodeRow = memo(function EpisodeRow({
  id,
  title,
  metadata,
  overview,
  imageUrl,
  blurhash,
  isCurrent,
  onSelect,
}: EpisodeRowProps) {
  const handlePress = useCallback(() => onSelect(id), [id, onSelect]);
  const accessibilityLabel = [title, metadata, isCurrent ? '正在播放' : null]
    .filter(Boolean)
    .join('，');

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isCurrent }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        isCurrent && styles.currentRow,
        pressed && styles.pressedRow,
      ]}
    >
      <View style={styles.thumbnailFrame} pointerEvents="none">
        <ItemImage
          cachePolicy="disk"
          contentFit="cover"
          placeholderBlurhash={blurhash}
          recyclingKey={id}
          style={styles.thumbnail}
          transition={120}
          uri={imageUrl}
        />
        {isCurrent ? (
          <View style={styles.playingBadge}>
            <Ionicons color="#111318" name="play" size={12} />
          </View>
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        {metadata ? (
          <Text numberOfLines={1} style={styles.metadata}>
            {metadata}
          </Text>
        ) : null}
        {overview ? (
          <Text numberOfLines={1} style={styles.overview}>
            {overview}
          </Text>
        ) : null}
      </View>

      <Ionicons
        color={isCurrent ? '#fff' : 'rgba(255,255,255,0.36)'}
        name={isCurrent ? 'volume-high' : 'chevron-forward'}
        size={isCurrent ? 16 : 15}
      />
    </Pressable>
  );
});

const getItemLayout = (_data: ArrayLike<EpisodeRowModel> | null | undefined, index: number) => ({
  index,
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
});

const keyExtractor = (item: EpisodeRowModel) => item.id;

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
  const currentIndex = useMemo(
    () => rows.findIndex((episode) => episode.id === currentItemId),
    [currentItemId, rows],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<EpisodeRowModel>) => (
      <EpisodeRow
        blurhash={item.blurhash}
        id={item.id}
        imageUrl={item.imageUrl}
        isCurrent={item.id === currentItemId}
        metadata={item.metadata}
        onSelect={onSelectEpisode}
        overview={item.overview}
        title={item.title}
      />
    ),
    [currentItemId, onSelectEpisode],
  );

  return (
    <FlatList
      contentContainerStyle={[styles.listContent, rows.length === 0 && styles.emptyListContent]}
      contentInsetAdjustmentBehavior="never"
      data={rows}
      extraData={currentItemId}
      getItemLayout={getItemLayout}
      initialNumToRender={8}
      initialScrollIndex={currentIndex > 0 ? currentIndex : undefined}
      keyExtractor={keyExtractor}
      ListEmptyComponent={<Text style={styles.emptyText}>暂无可用剧集</Text>}
      maxToRenderPerBatch={8}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      style={styles.list}
      testID="player-episode-panel"
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    padding: 24,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 12,
    height: ROW_HEIGHT,
    paddingHorizontal: 10,
  },
  currentRow: {
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  pressedRow: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  thumbnailFrame: {
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  metadata: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
    lineHeight: 15,
  },
  overview: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    lineHeight: 14,
  },
});
