import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import {
  episodesBySeasonQueryOptions,
  mediaSourcesQueryOptions,
} from '@/services/media/queryOptions';
import { MediaItem, MediaPerson } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

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
            renderItem={({ item: ep }) => {
              const isSelected = ep.id === selectedEpisode.id;
              return (
                <EpisodeCard
                  item={ep}
                  style={[detailViewStyles.horizontalCard, { opacity: isSelected ? 1 : 0.8 }]}
                  imgType="Primary"
                  onPress={() => {
                    setSelectedEpisode(ep);
                  }}
                  disableContextMenu
                  imgInfo={mediaAdapter.getImageInfo({
                    item: ep,
                    opts: { width: 400 },
                  })}
                />
              );
            }}
            keyExtractor={(item) => item.id!}
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
