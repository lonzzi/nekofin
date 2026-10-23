import { t as tr, type TranslationKey } from '@/lib/i18n';
import type { MediaItem } from '@/services/media/types';

export type ItemGridPage = MediaItem[] | { items: MediaItem[] };

export type ItemGridGroup = {
  key: string;
  title: string;
  items: MediaItem[];
};

export function createItemGridSections(
  groups: ItemGridGroup[],
  numColumns: number,
  episodeColumns: number,
) {
  return groups.map((group) => {
    const columns = group.key === 'Episode' ? episodeColumns : numColumns;
    return {
      ...group,
      data: Array.from({ length: Math.ceil(group.items.length / columns) }, (_, row) =>
        group.items.slice(row * columns, (row + 1) * columns),
      ),
    };
  });
}

const groupOrder = [
  'CollectionFolder',
  'Series',
  'Season',
  'Movie',
  'Episode',
  'MusicVideo',
  'Video',
  'BoxSet',
  'Playlist',
  'Folder',
  'Other',
];
const groupTitleMap: Record<string, TranslationKey> = {
  AggregateFolder: 'media.aggregateFolders',
  Audio: 'media.audio',
  AudioBook: 'media.audiobooks',
  BasePluginFolder: 'media.pluginFolders',
  Book: 'media.books',
  BoxSet: 'media.collections',
  Channel: 'media.channel',
  ChannelFolderItem: 'media.channelFolders',
  CollectionFolder: 'media.libraries',
  Folder: 'media.folders',
  Genre: 'media.genre',
  LiveTvChannel: 'media.liveTvChannels',
  LiveTvProgram: 'media.liveTvPrograms',
  ManualPlaylistsFolder: 'media.playlistFolders',
  MusicAlbum: 'media.musicAlbums',
  MusicArtist: 'media.musicArtists',
  MusicGenre: 'media.musicGenres',
  Person: 'media.people',
  Photo: 'media.photos',
  PhotoAlbum: 'media.photoAlbums',
  Playlist: 'media.playlists',
  PlaylistsFolder: 'media.playlistFolders',
  Program: 'media.programs',
  Recording: 'media.recordings',
  Season: 'media.season',
  Series: 'media.series',
  Movie: 'media.movies',
  Episode: 'media.episodes',
  MusicVideo: 'media.musicVideos',
  Studio: 'media.studios',
  Trailer: 'media.trailers',
  TvChannel: 'media.tvChannels',
  TvProgram: 'media.tvPrograms',
  UserRootFolder: 'media.userRoot',
  UserView: 'media.userViews',
  Video: 'media.video',
  Year: 'media.year',
  Other: 'common.other',
};

export function dedupeMediaItems(
  items: MediaItem[],
  getKey: (item: MediaItem) => string = (item) => item.id!,
): MediaItem[] {
  const merged: MediaItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id) continue;
    const key = getKey(item);
    if (seen.has(key)) continue;
    merged.push(item);
    seen.add(key);
  }

  return merged;
}

export function flattenItemGridPages(pages: ItemGridPage[] | undefined): MediaItem[] {
  if (!pages?.length) return [];
  return dedupeMediaItems(
    pages.flatMap((page) => {
      return Array.isArray(page) ? page : page.items;
    }),
  );
}

export function groupMediaItems(
  items: MediaItem[],
  disableGrouping = false,
  translate = tr,
): ItemGridGroup[] {
  if (disableGrouping) {
    return [{ key: 'all', title: '', items }];
  }

  const typeToItems: Record<string, MediaItem[]> = {};
  items.forEach((item) => {
    const key = item.type || 'Other';
    if (!typeToItems[key]) typeToItems[key] = [];
    typeToItems[key].push(item);
  });

  return Object.entries(typeToItems)
    .sort(
      (a, b) =>
        (groupOrder.indexOf(a[0]) === -1 ? 999 : groupOrder.indexOf(a[0])) -
        (groupOrder.indexOf(b[0]) === -1 ? 999 : groupOrder.indexOf(b[0])),
    )
    .map(([type, items]) => ({
      key: type,
      title: groupTitleMap[type] ? translate(groupTitleMap[type]) : type,
      items,
    }));
}
