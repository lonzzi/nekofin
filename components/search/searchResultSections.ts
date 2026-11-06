import { dedupeMediaItems, groupMediaItems } from '@/components/media/itemGridData';
import type { MediaItemSource } from '@/components/media/mediaSource';
import { t as tr } from '@/lib/i18n';
import type { MediaItem } from '@/services/media/types';

export type SearchMediaFilter = 'all' | 'Movie' | 'Series' | 'Episode';
export type SearchResultGroup = { source: MediaItemSource; items: MediaItem[] };
export type SearchResultRow = { key: string; items: MediaItem[] };
export type SearchResultSection = {
  key: string;
  source: MediaItemSource;
  cardType: 'series' | 'episode';
  title: string;
  showTypeTitle: boolean;
  showServerTitle: boolean;
  serverResultCount: number;
  data: SearchResultRow[];
};

export function createSearchResultSections({
  groups,
  filter,
  posterColumns,
  episodeColumns,
  translate = tr,
}: {
  groups: SearchResultGroup[];
  filter: SearchMediaFilter;
  posterColumns: number;
  episodeColumns: number;
  translate?: typeof tr;
}): SearchResultSection[] {
  return groups.flatMap(({ source, items }) => {
    const filtered = dedupeMediaItems(items).filter(
      (item) => filter === 'all' || item.type === filter,
    );
    const posters: MediaItem[] = [];
    const landscape: MediaItem[] = [];
    for (const item of filtered) {
      (['Movie', 'Series', 'Season'].includes(item.type ?? '') ? posters : landscape).push(item);
    }
    const mediaGroups = [
      ...(posters.length ? [{ key: 'posters', title: '', items: posters }] : []),
      ...groupMediaItems(landscape, false, translate),
    ];
    return mediaGroups.map((group, index) => {
      const cardType = group.key === 'posters' ? 'series' : 'episode';
      const columns = Math.max(1, cardType === 'series' ? posterColumns : episodeColumns);
      const key = `${source.server.id}:${group.key}`;
      return {
        key,
        source,
        cardType,
        title: group.title,
        showTypeTitle: cardType === 'episode' && mediaGroups.length > 1,
        showServerTitle: groups.length > 1 && index === 0,
        serverResultCount: filtered.length,
        data: Array.from({ length: Math.ceil(group.items.length / columns) }, (_, row) => {
          const items = group.items.slice(row * columns, (row + 1) * columns);
          return { key: `${key}:${items[0].id}`, items };
        }),
      };
    });
  });
}
