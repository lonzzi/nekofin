import DetailView from '@/components/detail-view';
import { DetailRequestState } from '@/components/detail-view/DetailRequestState';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import {
  firstEpisodeBySeasonQueryOptions,
  itemDetailQueryOptions,
} from '@/services/media/queryOptions';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function EpisodeDetailPage() {
  const { episodeId, seasonId } = useLocalSearchParams<{ episodeId?: string; seasonId?: string }>();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const firstEpisode = useQueryWithFocus(
    firstEpisodeBySeasonQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      seasonId,
      enabled: !episodeId,
    }),
  );
  const linkedEpisode = useQueryWithFocus(
    itemDetailQueryOptions({ adapter: mediaAdapter, currentServer, itemId: episodeId }),
  );

  const query = episodeId ? linkedEpisode : firstEpisode;
  const episode = query.data;

  if (!episode) {
    if (!episodeId && !seasonId) return null;
    return (
      <View style={{ padding: 16 }}>
        <DetailRequestState
          mode="series"
          isError={query.isError || query.isSuccess}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }

  return (
    <DetailView
      itemId={episode.seriesId || episode.id}
      mode={episode.seriesId ? 'series' : 'episode'}
      initialEpisode={episode}
      seasonId={seasonId}
    />
  );
}
