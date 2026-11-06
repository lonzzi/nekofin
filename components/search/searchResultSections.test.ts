import type { MediaItemSource } from '@/components/media/mediaSource';
import type { MediaAdapter, MediaItem, MediaServerInfo } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import { createSearchResultSections } from './searchResultSections';

const source = (id: string): MediaItemSource => ({
  server: { id, name: `Server ${id}` } as MediaServerInfo,
  adapter: {} as MediaAdapter,
});
const item = (id: string, type: MediaItem['type'] = 'Movie'): MediaItem => ({
  id,
  name: id,
  type,
  raw: {},
});
const layout = { filter: 'all', posterColumns: 2, episodeColumns: 1 } as const;

describe('search result sections', () => {
  it('separates servers with matching media IDs while removing duplicates within a server', () => {
    const first = source('a');
    const second = source('b');
    const sections = createSearchResultSections({
      ...layout,
      groups: [
        { source: first, items: [item('same'), item('same')] },
        { source: second, items: [item('same')] },
      ],
    });
    expect(sections.map((section) => section.key)).toEqual(['a:posters', 'b:posters']);
    expect(sections.map((section) => section.showServerTitle)).toEqual([true, true]);
    expect(sections.map((section) => section.serverResultCount)).toEqual([1, 1]);
    expect(sections[0].source).toBe(first);
    expect(sections[1].source).toBe(second);
    expect(sections[0].data[0].key).not.toBe(sections[1].data[0].key);
  });

  it('omits server headings for one server and uses independent poster and episode rows', () => {
    const movies = [item('m1'), item('m2'), item('m3')];
    const episode = item('e1', 'Episode');
    const sections = createSearchResultSections({
      ...layout,
      groups: [{ source: source('a'), items: [...movies, episode] }],
    });
    expect(sections.map((section) => section.showServerTitle)).toEqual([false, false]);
    expect(sections.map((section) => section.cardType)).toEqual(['series', 'episode']);
    expect(sections.map((section) => section.title)).toEqual(['', '单集']);
    expect(sections.map((section) => section.data.map((row) => row.items))).toEqual([
      [movies.slice(0, 2), movies.slice(2)],
      [[episode]],
    ]);
  });

  it('filters within each server and keeps attribution when only one server has matches', () => {
    const sections = createSearchResultSections({
      ...layout,
      filter: 'Episode',
      groups: [
        { source: source('a'), items: [item('movie'), item('episode', 'Episode')] },
        { source: source('b'), items: [item('movie')] },
      ],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      key: 'a:Episode',
      showServerTitle: true,
      showTypeTitle: false,
      serverResultCount: 1,
    });
    expect(sections[0].data.flatMap((row) => row.items.map((entry) => entry.id))).toEqual([
      'episode',
    ]);
  });

  it('shows a server heading only once across its media types and skips empty groups', () => {
    const sections = createSearchResultSections({
      ...layout,
      groups: [
        {
          source: source('a'),
          items: [item('series', 'Series'), item('movie'), item('episode', 'Episode')],
        },
        { source: source('b'), items: [] },
      ],
    });
    expect(sections.map((section) => section.showServerTitle)).toEqual([true, false]);
    expect(sections.map((section) => section.showTypeTitle)).toEqual([false, true]);
    expect(sections.every((section) => section.source.server.id === 'a')).toBe(true);
  });
});
