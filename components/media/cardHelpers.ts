import { t as tr } from '@/lib/i18n';
import { MediaItem } from '@/services/media/types';
import { getMediaUnplayedItemCount, isMediaItemPlayed } from '@/services/media/watchState';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';

export type CardRoute =
  | {
      pathname: '/movie/[id]';
      params: { id: string };
    }
  | {
      pathname: '/episode';
      params: { episodeId?: string; seasonId?: string };
    }
  | {
      pathname: '/series/[id]';
      params: { id: string };
    };

export function getCardWatchStatusSuffix(item: MediaItem): string {
  const count = getMediaUnplayedItemCount(item);
  if (count !== null) {
    return tr(
      item.type === 'Series' || item.type === 'Season'
        ? 'media.unwatchedEpisodesSuffix'
        : 'media.unwatchedItemsSuffix',
      { value: count },
    );
  }
  return isMediaItemPlayed(item) ? tr('media.watchedSuffix') : '';
}

export function formatUnplayedCount(count: number): string {
  return count >= 100 ? '99+' : String(count);
}

export const getSubtitle = (item: MediaItem) => {
  if (item.type === 'Episode') {
    const season = item.parentIndexNumber;
    const episode = item.indexNumber;
    const seasonText = season !== undefined ? `S${season}` : '';
    const episodeText = episode !== undefined ? `E${episode}` : '';

    if (seasonText || episodeText) {
      return `${seasonText}${episodeText} - ${item.name}`;
    }

    return item.name;
  }

  if (item.type === 'Movie') {
    return item.productionYear ?? tr('media.unknownDate');
  }

  if (item.type === 'Series') {
    const startYear = item.productionYear?.toString() ?? '';

    if (item.status === 'Continuing') {
      return startYear
        ? tr('media.yearRangeToPresent', { startYear: startYear })
        : tr('media.present');
    }

    if (item.endDate) {
      const endYear = new Date(item.endDate).getFullYear();

      if (startYear && parseInt(startYear) === endYear) {
        return startYear;
      }

      return startYear ? `${startYear} - ${endYear}` : `${endYear}`;
    }

    return startYear ?? tr('media.unknownDate');
  }

  return item.name;
};

export const getImagePreferenceOptions = (imgType: ImageType) => ({
  preferBackdrop: imgType === 'Backdrop',
  preferThumb: imgType === 'Thumb',
  preferBanner: imgType === 'Banner',
  preferLogo: imgType === 'Logo',
  width: 400,
});

export const getEpisodeCardRoute = (item: MediaItem): CardRoute | null => {
  if (!item.id) return null;

  if (item.type === 'Movie') {
    return {
      pathname: '/movie/[id]',
      params: { id: item.id },
    };
  }

  return {
    pathname: '/episode',
    params: { episodeId: item.id, seasonId: item.seasonId ?? undefined },
  };
};

export const getSeriesCardRoute = (item: MediaItem): CardRoute | null => {
  if (item.type === 'Season' && item.id) {
    return {
      pathname: '/episode',
      params: { seasonId: item.id },
    };
  }

  if (item.type === 'Series' || item.type === 'Episode') {
    const seriesId = item.seriesId ?? item.id;
    if (!seriesId) return null;

    return {
      pathname: '/series/[id]',
      params: { id: seriesId },
    };
  }

  if (item.type === 'Movie' && item.id) {
    return {
      pathname: '/movie/[id]',
      params: { id: item.id },
    };
  }

  return null;
};
