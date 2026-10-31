import { getMediaRailListConfig } from '@/components/media/railPerformanceConfig';
import { MenuView } from '@/components/ui/MenuView';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { ImageUrlInfo } from '@/lib/utils/image';
import {
  episodesBySeasonQueryOptions,
  mediaSourcesQueryOptions,
} from '@/services/media/queryOptions';
import { MediaItem, MediaPerson } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EpisodeCard } from '../media/Card';
import { ThemedText } from '../ThemedText';
import { detailViewStyles, ItemOverview } from './common';
import { DeferredDetailSections } from './DeferredDetailSections';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';
import { DetailPlaybackControls } from './DetailPlaybackControls';
import { DetailSummary } from './DetailSummary';
import { useDetailView } from './DetailViewContext';
import { EpisodeMediaInfoList } from './EpisodeMediaInfoList';
import {
  findEpisodeIndex,
  getDisplayEpisodes,
  getEpisodeHeaderText,
  getInitialEpisodeScrollIndex,
  getInitialSeasonId,
  getSeasonActions,
  getSeasonTitle,
  getSelectedEpisodeOrFallback,
} from './episodeSelection';

const episodeCardStyles = StyleSheet.create({
  selected: {
    opacity: 1,
  },
  unselected: {
    opacity: 0.8,
  },
});

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
  const handlePress = useCallback(() => {
    onSelect(episode);
  }, [episode, onSelect]);

  return (
    <EpisodeCard
      item={episode}
      style={[
        detailViewStyles.horizontalCard,
        isSelected ? episodeCardStyles.selected : episodeCardStyles.unselected,
      ]}
      imgType="Primary"
      onPress={handlePress}
      imgInfo={imageInfo}
    />
  );
});

export const EpisodeModeContent = ({
  seasons,
  episodes = [],
  people,
  similarItems,
  item,
  seasonId,
}: {
  seasons: MediaItem[];
  episodes?: MediaItem[];
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
  seasonId?: string;
}) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const subtitleColor = theme.colors.textSecondary;
  const { setTitle, setSelectedItem } = useDetailView();
  const mediaAdapter = useMediaAdapter();
  const { currentServer } = useMediaServers();
  const { width } = useContentDimensions();
  const cardWidth = theme.layout.mediaRail.episodeCardWidth - theme.spacing.xl;
  const railBatching = getMediaRailListConfig({
    cardWidth,
    gap: theme.spacing.md,
    horizontalPadding: theme.spacing.page + theme.spacing.sm,
    viewportWidth: width,
  });
  const getEpisodeLayout = useCallback(
    (_data: ArrayLike<MediaItem> | null | undefined, index: number) => ({
      index,
      length: cardWidth,
      offset: index * (cardWidth + theme.spacing.md),
    }),
    [cardWidth, theme.spacing.md],
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(() =>
    getInitialSeasonId(seasons, seasonId),
  );

  const [selectedEpisode, setSelectedEpisode] = useState<MediaItem>(item ?? episodes[0]);
  const flatListRef = useRef<FlatList<MediaItem>>(null);

  const { data: currentSeasonEpisodes = [] } = useQueryWithFocus(
    episodesBySeasonQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      seasonId: selectedSeasonId,
    }),
  );

  const {
    data: mediaSourcesData,
    isPending: isMediaInfoPending,
    isError: isMediaInfoError,
    refetch: refetchMediaSources,
  } = useQueryWithFocus(
    mediaSourcesQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      itemId: selectedEpisode?.id,
    }),
  );

  const mediaSources = mediaSourcesData?.mediaSources ?? [];

  const displayEpisodes = getDisplayEpisodes({
    selectedSeasonId,
    currentSeasonEpisodes,
    fallbackEpisodes: episodes,
  });
  const selectedEpisodeId = selectedEpisode.id;

  const episodeImageInfoById = useMemo(() => {
    const imageInfoById = new Map<string, ImageUrlInfo>();
    for (const episode of displayEpisodes) {
      if (!episode.id) continue;
      imageInfoById.set(
        episode.id,
        mediaAdapter.getImageInfo({
          item: episode,
          opts: { width: 400 },
        }),
      );
    }
    return imageInfoById;
  }, [displayEpisodes, mediaAdapter]);

  const handleSelectEpisode = useCallback((episode: MediaItem) => {
    setSelectedEpisode(episode);
  }, []);

  const renderEpisodeItem = useCallback(
    ({ item: episode }: { item: MediaItem }) => (
      <EpisodeSelectorItem
        episode={episode}
        imageInfo={episode.id ? episodeImageInfoById.get(episode.id) : undefined}
        isSelected={episode.id === selectedEpisodeId}
        onSelect={handleSelectEpisode}
      />
    ),
    [episodeImageInfoById, handleSelectEpisode, selectedEpisodeId],
  );

  const extractEpisodeKey = useCallback((episode: MediaItem) => episode.id!, []);

  useEffect(() => {
    const nextEpisode = getSelectedEpisodeOrFallback(displayEpisodes, selectedEpisode);
    if (nextEpisode.id !== selectedEpisode.id) {
      setSelectedEpisode(nextEpisode);
    }
  }, [displayEpisodes, selectedEpisode]);

  useEffect(() => {
    const index = findEpisodeIndex(displayEpisodes, selectedEpisode.id);
    if (flatListRef.current && index >= 0) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewOffset: 20 });
    }
  }, [displayEpisodes, selectedEpisode]);

  useEffect(() => {
    setTitle(selectedEpisode.name);
    setSelectedItem(selectedEpisode);
  }, [selectedEpisode, setTitle, setSelectedItem]);

  return (
    <>
      <DetailSummary
        item={selectedEpisode}
        metadata={
          <View style={{ gap: theme.spacing.sm }}>
            <ThemedText style={[theme.typography.footnote, { color: subtitleColor }]}>
              {getEpisodeHeaderText(selectedEpisode)}
            </ThemedText>
          </View>
        }
        controls={selectedEpisode?.id ? <DetailPlaybackControls item={selectedEpisode} /> : null}
        overview={<ItemOverview item={selectedEpisode} showEmptyPlaceholder />}
      />

      <DeferredDetailSections>
        <>
          {seasons && seasons.length > 0 && (
            <View
              style={[
                detailViewStyles.sectionBlock,
                { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
              ]}
            >
              <MenuView
                actions={getSeasonActions(seasons, selectedSeasonId)}
                onPressAction={({ nativeEvent }) => {
                  setSelectedSeasonId(nativeEvent.event);
                }}
              >
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                  }}
                >
                  <Text style={[theme.typography.bodyEmphasized, { color: textColor }]}>
                    {getSeasonTitle(seasons.find((s) => s.id === selectedSeasonId))}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={textColor} />
                </Pressable>
              </MenuView>
            </View>
          )}

          {displayEpisodes && displayEpisodes.length > 0 && (
            <View style={detailViewStyles.sectionBlock}>
              <FlatList
                {...railBatching}
                ref={flatListRef}
                horizontal
                removeClippedSubviews={false}
                data={displayEpisodes}
                getItemLayout={getEpisodeLayout}
                initialScrollIndex={getInitialEpisodeScrollIndex({
                  selectedIndex: findEpisodeIndex(displayEpisodes, selectedEpisodeId),
                  episodeCount: displayEpisodes.length,
                  cardWidth,
                  gap: theme.spacing.md,
                  horizontalPadding: theme.spacing.page + theme.spacing.sm,
                  viewportWidth: width,
                })}
                style={detailViewStyles.edgeToEdge}
                renderItem={renderEpisodeItem}
                keyExtractor={extractEpisodeKey}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={detailViewStyles.horizontalList}
              />
            </View>
          )}
        </>
        <PeopleSection items={people} />
        <SimilarItemsSection items={similarItems} />

        <EpisodeMediaInfoList
          key={selectedEpisode.id}
          mediaSources={mediaSources}
          isPending={isMediaInfoPending}
          isError={isMediaInfoError}
          onRetry={() => void refetchMediaSources()}
        />
      </DeferredDetailSections>
    </>
  );
};
