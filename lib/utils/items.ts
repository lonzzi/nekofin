/**
 * Item and playback helpers
 */
import {
  getJellyfinItemDownloadUrl,
  getJellyfinSeasonDownloadMap,
  getJellyfinSeriesDownloadMap,
} from '@/services/media/jellyfin/download';
import type { Api } from '@jellyfin/sdk';
import {
  BaseItemKind,
  ItemSortBy,
  type BaseItemDto,
  type BaseItemPerson,
  type MediaStream,
} from '@jellyfin/sdk/lib/generated-client';

import { isNil } from './guards';

/**
 * A list of valid collections that should be treated as folders.
 */
export const validLibraryTypes: BaseItemKind[] = [
  BaseItemKind.CollectionFolder,
  BaseItemKind.Folder,
  BaseItemKind.UserView,
  BaseItemKind.Playlist,
  BaseItemKind.PhotoAlbum,
];

export const validPersonTypes = [
  'Actor',
  'Director',
  'Composer',
  'Writer',
  'GuestStar',
  'Producer',
  'Conductor',
  'Lyricist',
];

export enum CardShapes {
  Portrait = 'portrait-card',
  Thumb = 'thumb-card',
  Square = 'square-card',
  Banner = 'banner-card',
}

/**
 * This sortOrder is commonly used across many requests. Define it here so it can be
 * used in multiple places without repeating the same code.
 */
export const defaultSortOrder = [
  ItemSortBy.PremiereDate,
  ItemSortBy.ProductionYear,
  ItemSortBy.SortName,
];

/**
 * Determines if the item is a person
 *
 * @param item - The item to be checked.
 * @returns Whether the provided item is of type BaseItemPerson.
 */
export function isPerson(item: BaseItemDto | BaseItemPerson): item is BaseItemPerson {
  return !!('Role' in item || (item.Type && validPersonTypes.includes(item.Type)));
}

/**
 * Checks if the item is a library
 */
export function isLibrary(item: BaseItemDto): boolean {
  return item.Type ? validLibraryTypes.includes(item.Type) : false;
}

/**
 * Get the Material Design Icon name associated with a type of library
 *
 * @returns Name of the Material Design Icon associated with the type
 */
export function getLibraryIcon(libraryType: string | undefined | null) {
  switch (libraryType?.toLowerCase()) {
    case 'movies': {
      return 'i-mdi:movie';
    }
    case 'music': {
      return 'i-mdi-music';
    }
    case 'photos': {
      return 'i-mdi:image';
    }
    case 'livetv': {
      return 'i-mdi:youtube-tv';
    }
    case 'tvshows': {
      return 'i-mdi:television-classic';
    }
    case 'homevideos': {
      return 'i-mdi:image-multiple';
    }
    case 'musicvideos': {
      return 'i-mdi:music-box';
    }
    case 'books': {
      return 'i-mdi:book-open-page-variant';
    }
    case 'channels': {
      return 'i-mdi:youtube';
    }
    case 'playlists': {
      return 'i-mdi:playlist-play';
    }
    default: {
      return 'i-mdi:folder';
    }
  }
}

/**
 * Get the card shape associated with a collection type
 *
 * @returns CSS class to use as the shape of the card
 */
export function getShapeFromCollectionType(collectionType: string | null | undefined): CardShapes {
  switch (collectionType?.toLowerCase()) {
    case 'livetv':
    case 'musicvideos': {
      return CardShapes.Thumb;
    }
    case 'folders':
    case 'playlists':
    case 'music': {
      return CardShapes.Square;
    }
    default: {
      return CardShapes.Portrait;
    }
  }
}

/**
 * Gets the card shape associated with a collection type
 *
 * @returns CSS class to use as the shape of the card
 */
export function getShapeFromItemType(itemType: BaseItemKind | null | undefined): CardShapes {
  if (!itemType) {
    return CardShapes.Portrait;
  }

  switch (itemType) {
    case BaseItemKind.Audio:
    case BaseItemKind.Folder:
    case BaseItemKind.MusicAlbum:
    case BaseItemKind.MusicArtist:
    case BaseItemKind.MusicGenre:
    case BaseItemKind.PhotoAlbum:
    case BaseItemKind.Playlist:
    case BaseItemKind.Video: {
      return CardShapes.Square;
    }
    case BaseItemKind.Episode:
    case BaseItemKind.MusicVideo:
    case BaseItemKind.CollectionFolder:
    case BaseItemKind.Studio: {
      return CardShapes.Thumb;
    }
    default: {
      return CardShapes.Portrait;
    }
  }
}

/**
 * Determine if an item can be identified.
 *
 * @param item - The item to be checked.
 * @returns Whether the item can be identified or not.
 */
export function canIdentify(item: BaseItemDto): boolean {
  const valid = [
    'Book',
    'BoxSet',
    'Movie',
    'MusicAlbum',
    'MusicArtist',
    'MusicVideo',
    'Person',
    'Series',
    'Trailer',
  ];

  return valid.includes(item.Type ?? '');
}

/**
 * Test if the passed item can be played by one of the players in the client.
 *
 * @param item - The item to be tested for playback support
 * @returns Whether the item can be played on this client or not
 */
export function canPlay(item: BaseItemDto | undefined): boolean {
  if (isNil(item)) {
    return false;
  }

  return !!(
    [
      'Audio',
      'AudioBook',
      'BoxSet',
      'Episode',
      'Movie',
      'MusicAlbum',
      'MusicArtist',
      'MusicGenre',
      'MusicVideo',
      'Playlist',
      'Season',
      'Series',
      'Trailer',
      'Video',
    ].includes(item.Type ?? '') ||
    ['Video', 'Audio'].includes(item.MediaType ?? '') ||
    item.IsFolder
  );
}
/**
 * Check if an item can be resumed
 */
export function canResume(item: BaseItemDto): boolean {
  return !!(item.UserData?.PlaybackPositionTicks && item.UserData.PlaybackPositionTicks > 0);
}
/**
 * Determine if an item can be mark as played
 *
 * @param item - Determines if an item can be marked as played
 * @returns Whether the item can be mark played or not
 */
export function canMarkWatched(item: BaseItemDto): boolean {
  if (['Series', 'Season', 'BoxSet', 'AudioPodcast', 'AudioBook'].includes(item.Type ?? '')) {
    return true;
  }

  return !!(item.MediaType === 'Video' && item.Type !== 'TvChannel');
}

/**
 * Determine if an item can be instant mixed.
 *
 * @param item - The item to be checked.
 * @returns Whether the item can be instant mixed or not.
 */
export function canInstantMix(item: BaseItemDto): boolean {
  return ['Audio', 'MusicAlbum', 'MusicArtist', 'MusicGenre'].includes(item.Type ?? '');
}

/**
 * Returns the appropiate material design icon for the BaseItemDto provided
 *
 * @param item - The item we want to get the icon for
 * @returns - The string that references the icon
 */
export function getItemIcon(item: BaseItemDto | BaseItemPerson) {
  let itemIcon;

  if (isPerson(item)) {
    itemIcon = 'i-mdi:account';
  } else {
    switch (item.Type) {
      case 'Audio': {
        itemIcon = 'i-mdi:music-note';
        break;
      }
      case 'AudioBook': {
        itemIcon = 'i-mdi:book-music';
        break;
      }
      case 'Book': {
        itemIcon = 'i-mdi:book-open-page-variant';
        break;
      }
      case 'BoxSet': {
        itemIcon = 'i-mdi:folder-multiple';
        break;
      }
      case 'Folder':
      case 'CollectionFolder': {
        itemIcon = 'i-mdi:folder';
        break;
      }
      case 'Movie': {
        itemIcon = 'i-mdi:filmstrip';
        break;
      }
      case 'MusicAlbum': {
        itemIcon = 'i-mdi:album';
        break;
      }
      case 'MusicArtist':
      case 'Person': {
        itemIcon = 'i-mdi:account';
        break;
      }
      case 'PhotoAlbum': {
        itemIcon = 'i-mdi:image-multiple';
        break;
      }
      case 'Playlist': {
        itemIcon = 'i-mdi:playlist-play';
        break;
      }
      case 'Series':
      case 'Episode': {
        itemIcon = 'i-mdi:television-classic';
        break;
      }
    }
  }

  return itemIcon;
}

/**
 * Filters the media streams based on the wanted type
 *
 * @param mediaStreams - Media streams to filter among
 * @param streamType - Stream type such as "audio" or "subtitles"
 * @returns - Filtered media streams
 */
export function getMediaStreams(mediaStreams: MediaStream[], streamType: string): MediaStream[] {
  return mediaStreams
    .filter((mediaStream) => mediaStream.Type === streamType)
    .map((stream, index) => ({
      ...stream,
      Index: index,
    }));
}

/**
 * Get the item ID either from the item itself or from the MediaSource
 *
 * @param item - The item to get the ID from
 * @param sourceIndex - The index of the MediaSource to get the ID from (optional)
 * @returns The ID of the item or the MediaSource
 */
export function getItemIdFromSourceIndex(item: BaseItemDto, sourceIndex?: number): string {
  if (isNil(sourceIndex)) {
    return item.Id ?? '';
  }

  const mediaSource = item.MediaSources?.[sourceIndex];

  return (mediaSource ? mediaSource.Id : item.Id) ?? '';
}

/**
 * Create an item download object that contains the URL and filename.
 *
 * @returns - A download object.
 */
export function getItemDownloadUrl(api: Api, itemId: string): string | undefined {
  return getJellyfinItemDownloadUrl(api, itemId);
}

/**
 * Get a map of an episode name and its download url, given a season.
 *
 * @returns - A map: [EpisodeName, DownloadUrl].
 */
export async function getItemSeasonDownloadMap(
  api: Api,
  seasonId: string,
  userId: string,
): Promise<Map<string, string>> {
  return getJellyfinSeasonDownloadMap(api, seasonId, userId);
}

/**
 * Get a map of an episode name and its download url, given a series.
 *
 * @returns - A map: [EpisodeName, DownloadUrl].
 */
export async function getItemSeriesDownloadMap(
  api: Api,
  seriesId: string,
  userId: string,
): Promise<Map<string, string>> {
  return getJellyfinSeriesDownloadMap(api, seriesId, userId);
}

/**
 * Format a number of bytes into a human readable string
 *
 * @param size - The number of bytes to format
 * @returns - A human readable string
 */
export function formatFileSize(size: number): string {
  if (size === 0) {
    return '0 B';
  }

  const i = Math.floor(Math.log(size) / Math.log(1024));

  return `${(size / Math.pow(1024, i)).toFixed(2)} ${['B', 'kiB', 'MiB', 'GiB', 'TiB', 'PiB'][i]}`;
}

/**
 * Format an item's bitrate into an standard human-readable format
 * Eg: 18112.27 kbps
 */
export function formatBitRate(bitrate: number): string {
  return `${(bitrate / 1000).toFixed(2)} kbps`;
}
