/**
 * Item and playback helpers
 */
import {
  BaseItemKind,
  type BaseItemDto,
  type BaseItemPerson,
} from '@jellyfin/sdk/lib/generated-client';

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
 * Determines if the item is a person
 *
 * @param item - The item to be checked.
 * @returns Whether the provided item is of type BaseItemPerson.
 */
export function isPerson(item: BaseItemDto | BaseItemPerson): item is BaseItemPerson {
  return !!('Role' in item || (item.Type && validPersonTypes.includes(item.Type)));
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
