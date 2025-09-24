import { VideoPlayer } from '@/components/player';
import { useLocalSearchParams } from 'expo-router';

export default function Player() {
  const { itemId } = useLocalSearchParams<{
    itemId: string;
  }>();

  return <VideoPlayer itemId={itemId} />;
}
