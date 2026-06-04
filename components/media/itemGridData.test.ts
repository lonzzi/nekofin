import type { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import { dedupeMediaItems, flattenItemGridPages, groupMediaItems } from './itemGridData';

const item = (id: string, type: MediaItem['type']): MediaItem => ({
  id,
  name: id,
  type,
  raw: {},
});

describe('item grid data helpers', () => {
  it('dedupes media items by id while preserving first-seen order', () => {
    expect(
      dedupeMediaItems([item('a', 'Movie'), item('b', 'Series'), item('a', 'Episode')]),
    ).toEqual([item('a', 'Movie'), item('b', 'Series')]);
  });

  it('flattens array and paged item shapes', () => {
    expect(
      flattenItemGridPages([
        [item('a', 'Movie')],
        { items: [item('b', 'Series'), item('a', 'Movie')] },
      ]),
    ).toEqual([item('a', 'Movie'), item('b', 'Series')]);
  });

  it('groups media items in display order', () => {
    expect(
      groupMediaItems([item('e', 'Episode'), item('s', 'Series'), item('m', 'Movie')]),
    ).toEqual([
      { key: 'Series', title: '剧集', items: [item('s', 'Series')] },
      { key: 'Movie', title: '电影', items: [item('m', 'Movie')] },
      { key: 'Episode', title: '单集', items: [item('e', 'Episode')] },
    ]);
  });

  it('can disable grouping for flat layouts', () => {
    const items = [item('s', 'Series')];

    expect(groupMediaItems(items, true)).toEqual([{ key: 'all', title: '', items }]);
  });
});
