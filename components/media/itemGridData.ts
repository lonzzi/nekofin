import type { MediaItem } from '@/services/media/types';

export type ItemGridPage = MediaItem[] | { items: MediaItem[] };

export type ItemGridGroup = {
  key: string;
  title: string;
  items: MediaItem[];
};

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
const groupTitleMap: Record<string, string> = {
  AggregateFolder: '聚合文件夹',
  Audio: '音频',
  AudioBook: '有声书',
  BasePluginFolder: '插件文件夹',
  Book: '图书',
  BoxSet: '合集',
  Channel: '频道',
  ChannelFolderItem: '频道文件夹',
  CollectionFolder: '媒体库',
  Folder: '文件夹',
  Genre: '类型',
  LiveTvChannel: '直播频道',
  LiveTvProgram: '直播节目',
  ManualPlaylistsFolder: '播放列表文件夹',
  MusicAlbum: '音乐专辑',
  MusicArtist: '音乐艺人',
  MusicGenre: '音乐类型',
  Person: '人物',
  Photo: '照片',
  PhotoAlbum: '相册',
  Playlist: '播放列表',
  PlaylistsFolder: '播放列表文件夹',
  Program: '节目',
  Recording: '录制',
  Season: '季',
  Series: '剧集',
  Movie: '电影',
  Episode: '单集',
  MusicVideo: '音乐视频',
  Studio: '工作室',
  Trailer: '预告片',
  TvChannel: '电视频道',
  TvProgram: '电视节目',
  UserRootFolder: '用户根目录',
  UserView: '用户视图',
  Video: '视频',
  Year: '年份',
  Other: '其他',
};

export function dedupeMediaItems(items: MediaItem[]): MediaItem[] {
  const merged: MediaItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    merged.push(item);
    seen.add(item.id);
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

export function groupMediaItems(items: MediaItem[], disableGrouping = false): ItemGridGroup[] {
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
      title: groupTitleMap[type] || type,
      items,
    }));
}
