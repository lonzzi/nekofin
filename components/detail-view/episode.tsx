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
import { MenuView } from '@react-native-menu/menu';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EpisodeCard, SeriesCard } from '../media/Card';
import { ThemedText } from '../ThemedText';
import { detailViewStyles, ItemOverview, PlayButton } from './common';
import { useDetailView } from './DetailViewContext';
import { EpisodeMediaInfoList } from './EpisodeMediaInfoList';
import {
  findEpisodeIndex,
  getDisplayEpisodes,
  getEpisodeHeaderText,
  getInitialSeasonId,
  getSeasonActions,
  getSeasonTitle,
  getSelectedEpisodeOrFallback,
} from './episodeSelection';
import { PersonItem } from './PersonItem';

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
      disableContextMenu
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
  const { setTitle, setBackgroundImageUrl, setSelectedItem } = useDetailView();
  const mediaAdapter = useMediaAdapter();
  const { currentServer } = useMediaServers();

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

  const { data: mediaSourcesData } = useQueryWithFocus(
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

    const imageInfo = mediaAdapter.getImageInfo({ item: selectedEpisode, opts: { width: 1200 } });
    setBackgroundImageUrl(imageInfo.url);
  }, [selectedEpisode, setTitle, setSelectedItem, mediaAdapter, setBackgroundImageUrl]);

  return (
    <>
      <View style={{ gap: theme.spacing.sm }}>
        <ThemedText style={[theme.typography.footnote, { color: subtitleColor }]}>
          {getEpisodeHeaderText(selectedEpisode)}
        </ThemedText>
      </View>

      {!!selectedEpisode?.id && <PlayButton item={selectedEpisode} />}

      <ItemOverview item={selectedEpisode} reserveCollapsedSpace />

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
            ref={flatListRef}
            horizontal
            removeClippedSubviews={false}
            data={displayEpisodes}
            style={detailViewStyles.edgeToEdge}
            onScrollToIndexFailed={() => {
              setTimeout(() => {
                const index = findEpisodeIndex(displayEpisodes, selectedEpisode.id);
                if (flatListRef.current && index >= 0) {
                  flatListRef.current.scrollToIndex({ index, animated: true, viewOffset: 20 });
                }
              }, 50);
            }}
            renderItem={renderEpisodeItem}
            keyExtractor={extractEpisodeKey}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      <EpisodeMediaInfoList mediaSources={mediaSources} />

      {people && people.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>演职人员</Text>
          <FlatList
            horizontal
            removeClippedSubviews={false}
            data={people}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <PersonItem item={item} />}
            keyExtractor={(item) => `${item.id ?? item.name}-${item.role ?? ''}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {similarItems && similarItems.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>更多类似的</Text>
          <FlatList
            horizontal
            removeClippedSubviews={false}
            data={similarItems}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => (
              <SeriesCard item={item} imgType="Primary" disableContextMenu />
            )}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}
    </>
  );
};
