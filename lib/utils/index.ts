import { getCommentsByEpisodeId, searchAnimesByKeyword } from '@/services/dandanplay';
import { MediaItem } from '@/services/media/types';
import uuid from 'react-native-uuid';

import { storage } from '../storage';

export const getDeviceId = () => {
  const deviceId = storage.getString('deviceId');
  if (!deviceId) {
    const newDeviceId = uuid.v4();
    storage.set('deviceId', newDeviceId);
    return newDeviceId;
  }
  return deviceId;
};

export const getCommentsByItem = async (item: MediaItem, originalTitle?: string | null) => {
  const seriesName = item.seriesName;
  const seasonNumber = item.parentIndexNumber ?? 1;
  const episodeNumber = item.indexNumber;
  const seriesId = item.seriesId;

  let animes = await searchAnimesByKeyword(seriesName ?? '');
  if (animes.length === 0) {
    animes = await searchAnimesByKeyword(originalTitle ?? '');
  }
  if (animes.length === 0) {
    return { comments: [], episodeInfo: undefined };
  }
  const anime = animes[seasonNumber - 1];
  if (anime && episodeNumber) {
    const comments = await getCommentsByEpisodeId(anime.episodes[episodeNumber - 1].episodeId);
    return {
      comments,
      episodeInfo: {
        animeTitle: anime.animeTitle,
        episodeTitle: anime.episodes[episodeNumber - 1].episodeTitle,
      },
    };
  }
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export {
  formatChineseDurationFromTicks,
  formatDurationFromTicks,
  formatTimeWorklet,
  ticksToMilliseconds,
  ticksToSeconds,
} from './duration';
export { formatBitrate, formatRating } from './format';
export { isNil } from './guards';
