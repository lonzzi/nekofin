import { t as tr } from '@/lib/i18n';

import type { MediaItem, MediaServerInfo } from './types';

export const AGGREGATE_HOME_SECTIONS = ['resume', 'nextup', 'latest'] as const;
export type AggregateHomeSection = (typeof AGGREGATE_HOME_SECTIONS)[number];
export type AggregateHomeEntry = { key: string; item: MediaItem; server: MediaServerInfo };
export type AggregateHomeSource = { server: MediaServerInfo; items: MediaItem[] };
export type AggregateLatestFolder = { server: MediaServerInfo; folder: MediaItem };

/** Keep the same per-account library visibility and row limit as the account home. */
export function groupAggregateLatestFolders(
  sources: AggregateHomeSource[],
  hidden: Record<string, string[]>,
  translate: typeof tr = tr,
) {
  const groups = new Map<
    string,
    { key: string; title: string; folders: AggregateLatestFolder[] }
  >();
  for (const { server, items } of sources) {
    const visible = items
      .filter((item) => item.id && !hidden[server.id]?.includes(item.id))
      .slice(0, 4);
    for (const folder of visible) {
      const key = `latest:${folder.collectionType ?? ''}:${folder.name ?? ''}`;
      const group = groups.get(key) ?? {
        key,
        title: translate('home.recentlyAddedInLibrary', { value: folder.name ?? '' }),
        folders: [],
      };
      group.folders.push({ server, folder });
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

/** Interleave accounts without collapsing matching item IDs from different servers. */
export function mergeAggregateHomeItems(
  sources: AggregateHomeSource[],
  section: AggregateHomeSection,
  limit = 30,
): AggregateHomeEntry[] {
  const entries: AggregateHomeEntry[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...sources.map((source) => source.items.length));
  for (let index = 0; index < longest; index++) {
    for (const { server, items } of sources) {
      const item = items[index];
      if (!item?.id) continue;
      const key = `${server.id}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, item, server });
    }
  }
  if (section === 'latest') {
    const timestamp = (item: MediaItem) => {
      const value = Date.parse(item.dateCreated ?? '');
      return Number.isFinite(value) ? value : 0;
    };
    entries.sort((a, b) => timestamp(b.item) - timestamp(a.item));
  }
  return entries.slice(0, limit);
}
