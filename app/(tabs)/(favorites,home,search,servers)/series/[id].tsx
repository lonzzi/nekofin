import DetailView from '@/components/detail-view';
import { useLocalSearchParams } from 'expo-router';

export default function SeriesDetailPage() {
  const { id, episodeId, seasonId } = useLocalSearchParams<{
    id: string;
    episodeId?: string;
    seasonId?: string;
  }>();

  return <DetailView itemId={id} mode="series" episodeId={episodeId} seasonId={seasonId} />;
}
