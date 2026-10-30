import type { MediaItem, MediaUserData } from './types';

const aggregateWatchStateTypes = new Set<MediaItem['type']>([
  'Series',
  'Season',
  'BoxSet',
  'Folder',
]);
const playedStateTypes = new Set<MediaItem['type']>([
  ...aggregateWatchStateTypes,
  'Movie',
  'Episode',
  'Video',
  'MusicVideo',
  'Recording',
  'Trailer',
  'AudioBook',
  'Book',
]);
const liveItemTypes = new Set<MediaItem['type']>([
  'TvChannel',
  'LiveTvChannel',
  'Program',
  'TvProgram',
  'LiveTvProgram',
]);

export function supportsMediaPlayedState(item: MediaItem): boolean {
  if (liveItemTypes.has(item.type)) return false;
  return playedStateTypes.has(item.type) || item.mediaType === 'Video' || item.mediaType === 'Book';
}

export function getMediaUnplayedItemCount(
  item: MediaItem,
  userData: MediaUserData | null | undefined = item.userData,
): number | null {
  if (!aggregateWatchStateTypes.has(item.type)) return null;
  const count = userData?.unplayedItemCount;
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? count : null;
}

export function isMediaItemPlayed(
  item: MediaItem,
  userData: MediaUserData | null | undefined = item.userData,
): boolean {
  if (!supportsMediaPlayedState(item)) return false;
  // Newly added items take precedence over a previous aggregate completion flag.
  if (getMediaUnplayedItemCount(item, userData) !== null) return false;

  const percentage = userData?.playedPercentage;
  return (
    userData?.played === true ||
    (typeof percentage === 'number' && Number.isFinite(percentage) && percentage >= 100)
  );
}
