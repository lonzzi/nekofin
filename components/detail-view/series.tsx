import { useAppTheme } from '@/lib/theme';
import type { MediaItem, MediaPerson } from '@/services/media/types';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { getSubtitle } from '../media/cardHelpers';
import { ItemInfoList, ItemMeta } from './common';
import { DeferredDetailSections } from './DeferredDetailSections';
import { EpisodeOverviewSection, PeopleSection, SimilarItemsSection } from './DetailMediaSections';
import {
  DetailPlaybackControls,
  DetailPlaybackControlsPlaceholder,
} from './DetailPlaybackControls';
import { DetailSummary } from './DetailSummary';
import { useDetailView } from './DetailViewContext';
import { EpisodeMediaInfoList } from './EpisodeMediaInfoList';
import { getEpisodeHeaderText } from './episodeSelection';
import { EpisodeSelector } from './EpisodeSelector';
import { useEpisodeSelection } from './useEpisodeSelection';

export const SeriesModeContent = ({
  seasons,
  nextUpItems,
  episodes,
  initialEpisode,
  seasonId,
  people,
  similarItems,
  item,
}: {
  seasons: MediaItem[];
  nextUpItems: MediaItem[];
  episodes: MediaItem[];
  initialEpisode?: MediaItem;
  seasonId?: string;
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
}) => {
  const theme = useAppTheme();
  const { setSelectedItem } = useDetailView();
  const selection = useEpisodeSelection({
    item,
    seasons,
    episodes,
    nextUpItems,
    initialEpisode,
    seasonId,
  });
  const { selectedEpisode } = selection;
  const isStandaloneEpisode = item.type === 'Episode';
  useEffect(() => {
    if (isStandaloneEpisode) setSelectedItem(selectedEpisode ?? null);
  }, [isStandaloneEpisode, selectedEpisode, setSelectedItem]);

  return (
    <>
      <DetailSummary
        item={item}
        episodeTitle={selectedEpisode?.name}
        metadata={isStandaloneEpisode ? null : <ItemMeta item={item} />}
        controls={
          selectedEpisode ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                numberOfLines={2}
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {isStandaloneEpisode
                  ? getEpisodeHeaderText(selectedEpisode)
                  : getSubtitle(selectedEpisode)}
              </Text>
              <DetailPlaybackControls item={selectedEpisode} />
            </View>
          ) : selection.isPending ? (
            <DetailPlaybackControlsPlaceholder />
          ) : null
        }
      />

      <DeferredDetailSections>
        <EpisodeSelector
          seasons={seasons}
          selectedSeasonId={selection.selectedSeasonId}
          selectedEpisodeId={selectedEpisode?.id}
          episodes={selection.displayEpisodes}
          onSelectSeason={selection.selectSeason}
          onSelectEpisode={selection.selectEpisode}
          isPending={selection.isPending}
          isError={selection.isError}
        />
        <EpisodeOverviewSection episode={selectedEpisode} />
        <PeopleSection items={people} />
        <SimilarItemsSection items={similarItems} />
        {selectedEpisode ? (
          <EpisodeMediaInfoList key={selectedEpisode.id} episodeId={selectedEpisode.id} />
        ) : null}
        {isStandaloneEpisode ? null : <ItemInfoList item={item} />}
      </DeferredDetailSections>
    </>
  );
};
