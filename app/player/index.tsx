import { VideoPlayer } from '@/components/player';
import { parsePlaybackSelection } from '@/services/media/playbackSelection';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function Player() {
  const { itemId, mediaSourceId, audioStreamIndex, subtitleStreamIndex } = useLocalSearchParams<{
    itemId: string;
    mediaSourceId?: string;
    audioStreamIndex?: string;
    subtitleStreamIndex?: string;
  }>();
  const selection = useMemo(
    () => parsePlaybackSelection({ mediaSourceId, audioStreamIndex, subtitleStreamIndex }),
    [mediaSourceId, audioStreamIndex, subtitleStreamIndex],
  );

  return <VideoPlayer key={itemId} itemId={itemId} initialSelection={selection} />;
}
