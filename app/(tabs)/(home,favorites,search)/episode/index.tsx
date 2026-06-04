import DetailView from '@/components/detail-view';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { firstEpisodeBySeasonQueryOptions } from '@/services/media/queryOptions';
import { useLocalSearchParams } from 'expo-router';

export default function EpisodeDetailPage() {
  const { episodeId, seasonId } = useLocalSearchParams<{ episodeId?: string; seasonId?: string }>();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const { data: firstEpisode } = useQueryWithFocus({
    ...firstEpisodeBySeasonQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      seasonId,
      enabled: !episodeId,
    }),
  });

  const itemId = episodeId ?? firstEpisode?.id;

  if (!itemId) {
    return null;
  }

  return <DetailView itemId={itemId} seasonId={seasonId} mode="episode" />;
}
