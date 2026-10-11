import DetailView from '@/components/detail-view';
import { useLocalSearchParams } from 'expo-router';

export default function MovieDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <DetailView itemId={id} mode="movie" />;
}
