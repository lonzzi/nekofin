import { getMediaRailListConfig } from '@/components/media/railPerformanceConfig';
import { MenuView } from '@/components/ui/MenuView';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import type { ImageUrlInfo } from '@/lib/utils/image';
import type { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EpisodeCard } from '../media/Card';
import { detailViewStyles } from './common';
import {
  findEpisodeIndex,
  getInitialEpisodeScrollIndex,
  getSeasonActions,
  getSeasonTitle,
} from './episodeSelection';

const EpisodeSelectorItem = memo(function EpisodeSelectorItem({
  episode,
  imageInfo,
  isSelected,
  onSelect,
}: {
  episode: MediaItem;
  imageInfo?: ImageUrlInfo;
  isSelected: boolean;
  onSelect: (episode: MediaItem) => void;
}) {
  const handlePress = useCallback(() => onSelect(episode), [episode, onSelect]);
  return (
    <EpisodeCard
      item={episode}
      style={[detailViewStyles.horizontalCard, !isSelected && styles.unselected]}
      imgType="Primary"
      selected={isSelected}
      onPress={handlePress}
      imgInfo={imageInfo}
    />
  );
});

export function EpisodeSelector({
  seasons,
  selectedSeasonId,
  selectedEpisodeId,
  episodes,
  onSelectSeason,
  onSelectEpisode,
  isPending,
  isError,
  onRetry,
}: {
  seasons: MediaItem[];
  selectedSeasonId: string;
  selectedEpisodeId?: string;
  episodes: MediaItem[];
  onSelectSeason: (seasonId: string) => void;
  onSelectEpisode: (episode: MediaItem) => void;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const adapter = useMediaAdapter();
  const { width } = useContentDimensions();
  const list = useRef<FlatList<MediaItem>>(null);
  const cardWidth = theme.layout.mediaRail.episodeCardWidth - theme.spacing.xl;
  const horizontalPadding = theme.spacing.page + theme.spacing.sm;
  const gap = theme.spacing.md;
  const getItemLayout = useCallback(
    (_data: ArrayLike<MediaItem> | null | undefined, index: number) => ({
      index,
      length: cardWidth,
      offset: index * (cardWidth + gap),
    }),
    [cardWidth, gap],
  );
  const images = useMemo(
    () =>
      new Map(
        episodes.map((episode) => [
          episode.id,
          adapter.getImageInfo({ item: episode, opts: { width: 400 } }),
        ]),
      ),
    [adapter, episodes],
  );
  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <EpisodeSelectorItem
        episode={item}
        imageInfo={images.get(item.id)}
        isSelected={item.id === selectedEpisodeId}
        onSelect={onSelectEpisode}
      />
    ),
    [images, onSelectEpisode, selectedEpisodeId],
  );
  useEffect(() => {
    const index = findEpisodeIndex(episodes, selectedEpisodeId);
    if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewOffset: 20 });
  }, [episodes, selectedEpisodeId]);

  return (
    <View style={detailViewStyles.sectionBlock}>
      {seasons.length ? (
        <MenuView
          title={getSeasonTitle(seasons.find((season) => season.id === selectedSeasonId))}
          actions={getSeasonActions(seasons, selectedSeasonId)}
          onPressAction={({ nativeEvent }) => onSelectSeason(nativeEvent.event)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('media.seasonNumber')}
            style={styles.season}
          >
            <Text style={[theme.typography.bodyEmphasized, { color: theme.colors.text }]}>
              {getSeasonTitle(seasons.find((season) => season.id === selectedSeasonId))}
            </Text>
            {seasons.length > 1 ? (
              <Ionicons name="chevron-down" size={16} color={theme.colors.text} />
            ) : null}
          </Pressable>
        </MenuView>
      ) : null}
      {episodes.length ? (
        <FlatList
          {...getMediaRailListConfig({ cardWidth, gap, horizontalPadding, viewportWidth: width })}
          ref={list}
          horizontal
          removeClippedSubviews={false}
          data={episodes}
          extraData={selectedEpisodeId}
          getItemLayout={getItemLayout}
          initialScrollIndex={getInitialEpisodeScrollIndex({
            selectedIndex: findEpisodeIndex(episodes, selectedEpisodeId),
            episodeCount: episodes.length,
            cardWidth,
            gap,
            horizontalPadding,
            viewportWidth: width,
          })}
          style={detailViewStyles.edgeToEdge}
          renderItem={renderItem}
          keyExtractor={(episode) => episode.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={detailViewStyles.horizontalList}
        />
      ) : isPending ? (
        <ActivityIndicator color={theme.colors.tint} accessibilityLabel={tr('common.loading')} />
      ) : isError ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={[theme.typography.body, { color: theme.colors.tint }]}>
            {tr('media.episodeLoadFailed')} · {tr('common.retry')}
          </Text>
        </Pressable>
      ) : (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {tr('media.noEpisodes')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  unselected: { opacity: 0.8 },
  season: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  retry: { paddingVertical: 12 },
});
