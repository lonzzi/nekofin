import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { mediaSourcesQueryOptions } from '@/services/media/queryOptions';
import type { MediaItem, MediaPerson } from '@/services/media/types';
import { useEffect } from 'react';

import { ThemedText } from '../ThemedText';
import { ItemOverview } from './common';
import { DeferredDetailSections } from './DeferredDetailSections';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';
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

export const EpisodeModeContent = ({
  seasons,
  episodes,
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
  const { setSelectedItem } = useDetailView();
  const adapter = useMediaAdapter();
  const { currentServer } = useMediaServers();
  const selection = useEpisodeSelection({ item, seasons, episodes, seasonId });
  const { selectedEpisode } = selection;
  const mediaSources = useQueryWithFocus(
    mediaSourcesQueryOptions({ adapter, currentServer, itemId: selectedEpisode?.id }),
  );

  useEffect(() => {
    setSelectedItem(selectedEpisode ?? null);
  }, [selectedEpisode, setSelectedItem]);

  return (
    <>
      <DetailSummary
        item={selectedEpisode ?? item}
        episodeTitle={selectedEpisode?.name}
        metadata={
          selectedEpisode ? (
            <ThemedText style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {getEpisodeHeaderText(selectedEpisode)}
            </ThemedText>
          ) : null
        }
        controls={
          selectedEpisode ? (
            <DetailPlaybackControls item={selectedEpisode} />
          ) : selection.isPending ? (
            <DetailPlaybackControlsPlaceholder />
          ) : null
        }
        overview={
          selectedEpisode ? <ItemOverview item={selectedEpisode} showEmptyPlaceholder /> : null
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
          onRetry={() => void selection.refetch()}
        />
        <PeopleSection items={people} />
        <SimilarItemsSection items={similarItems} />
        {selectedEpisode ? (
          <EpisodeMediaInfoList
            key={selectedEpisode.id}
            mediaSources={mediaSources.data?.mediaSources ?? []}
            isPending={mediaSources.isPending}
            isError={mediaSources.isError}
            onRetry={() => void mediaSources.refetch()}
          />
        ) : null}
      </DeferredDetailSections>
    </>
  );
};
