import type { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  createItemGridSections,
  dedupeMediaItems,
  flattenItemGridPages,
  groupMediaItems,
} from './itemGridData';

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

  it('retains matching IDs from different servers in aggregate grids', () => {
    const first = item('same', 'Movie');
    const second = item('same', 'Movie');
    const sources = new Map([
      [first, 'a'],
      [second, 'b'],
    ]);
    expect(
      dedupeMediaItems([first, second, first], (item) => `${sources.get(item)}:${item.id}`),
    ).toEqual([first, second]);
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

  it('keeps mixed favorites in vertical rows with independent poster and episode columns', () => {
    const series = Array.from({ length: 5 }, (_, i) => item(`s${i}`, 'Series'));
    const movie = item('m', 'Movie');
    const episodes = [item('e1', 'Episode'), item('e2', 'Episode')];
    const sections = createItemGridSections(groupMediaItems([...series, movie, ...episodes]), 2, 1);

    expect(sections.map((section) => section.data)).toEqual([
      [series.slice(0, 2), series.slice(2, 4), series.slice(4)],
      [[movie]],
      episodes.map((episode) => [episode]),
    ]);
  });

  it('reflows collection rows without losing items when the column count changes', () => {
    const items = Array.from({ length: 7 }, (_, i) => item(`s${i}`, 'Series'));
    const groups = groupMediaItems(items);
    expect(createItemGridSections(groups, 3, 2)[0].data).toEqual([
      items.slice(0, 3),
      items.slice(3, 6),
      items.slice(6),
    ]);
    expect(createItemGridSections(groups, 2, 2)[0].data.flat()).toEqual(items);
  });
});
