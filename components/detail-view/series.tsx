import { useAppTheme } from '@/lib/theme';
import type { MediaItem, MediaPerson } from '@/services/media/types';
import { Text, View } from 'react-native';

import { getSubtitle } from '../media/cardHelpers';
import { ItemInfoList, ItemMeta, ItemOverview } from './common';
import { DeferredDetailSections } from './DeferredDetailSections';
import { PeopleSection, SimilarItemsSection } from './DetailMediaSections';
import {
  DetailPlaybackControls,
  DetailPlaybackControlsPlaceholder,
} from './DetailPlaybackControls';
import { DetailSummary } from './DetailSummary';
import { EpisodeSelector } from './EpisodeSelector';
import { useEpisodeSelection } from './useEpisodeSelection';

export const SeriesModeContent = ({
  seasons,
  nextUpItems,
  people,
  similarItems,
  item,
}: {
  seasons: MediaItem[];
  nextUpItems: MediaItem[];
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
}) => {
  const theme = useAppTheme();
  const selection = useEpisodeSelection({ item, seasons, nextUpItems });
  const { selectedEpisode } = selection;
  return (
    <>
      <DetailSummary
        item={item}
        episodeTitle={selectedEpisode?.name}
        metadata={<ItemMeta item={item} />}
        controls={
          selectedEpisode ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Text
                numberOfLines={2}
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {getSubtitle(selectedEpisode)}
              </Text>
              <DetailPlaybackControls item={selectedEpisode} />
            </View>
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
        />
        <ItemInfoList item={item} />
        <PeopleSection items={people} />
        <SimilarItemsSection items={similarItems} />
      </DeferredDetailSections>
    </>
  );
};
