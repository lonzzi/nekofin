import type { MediaItem } from '@/services/media/types';

export type ItemGridPage = MediaItem[] | { items: MediaItem[] };

export type ItemGridGroup = {
  key: string;
  title: string;
  items: MediaItem[];
};

const groupOrder = ['Series', 'Movie', 'Episode', 'MusicVideo', 'Other'];
const groupTitleMap: Record<string, string> = {
  Series: '剧集',
  Movie: '电影',
  Episode: '单集',
  MusicVideo: '音乐视频',
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
