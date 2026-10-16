import { VideoPlayer } from '@/components/player';
import { parsePlaybackSelection } from '@/services/media/playbackSelection';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function Player() {
  const { itemId, mediaSourceId, audioStreamIndex, subtitleStreamIndex, quality } =
    useLocalSearchParams<{
      itemId: string;
      mediaSourceId?: string;
      audioStreamIndex?: string;
      subtitleStreamIndex?: string;
      quality?: string;
    }>();
  const selection = useMemo(
    () => parsePlaybackSelection({ mediaSourceId, audioStreamIndex, subtitleStreamIndex, quality }),
    [mediaSourceId, audioStreamIndex, subtitleStreamIndex, quality],
  );

  return <VideoPlayer key={itemId} itemId={itemId} initialSelection={selection} />;
}
