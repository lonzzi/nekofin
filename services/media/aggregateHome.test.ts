import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { groupAggregateLatestFolders, mergeAggregateHomeItems } from './aggregateHome';
import { homeResumeQueryOptions } from './queryOptions';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

const server = (id: string): MediaServerInfo => ({
  id,
  name: id,
  type: 'jellyfin',
  address: 'https://example.com',
  userId: `user-${id}`,
  username: 'test',
  userAvatar: '',
  accessToken: '',
  createdAt: 0,
});
const item = (id: string, dateCreated?: string): MediaItem => ({
  id,
  name: id,
  type: 'Movie',
  raw: {},
  dateCreated,
});

describe('aggregate home', () => {
  it('aggregates matching libraries while preserving each server and folder for view-all', () => {
    const a = server('a');
    const b = server('b');
    const folder = (id: string, collectionType = 'tvshows') => ({
      ...item(id),
      name: '番剧',
      collectionType,
    });
    const groups = groupAggregateLatestFolders(
      [
        { server: a, items: [folder('library-a')] },
        { server: b, items: [folder('library-b'), folder('movies', 'movies')] },
      ],
      {},
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].folders.map(({ server, folder }) => [server.id, folder.id])).toEqual([
      ['a', 'library-a'],
      ['b', 'library-b'],
    ]);
    expect(groups[1].folders[0].folder.id).toBe('movies');
  });

  it('applies account-specific hidden libraries before the four-row account-home limit', () => {
    const folders = Array.from({ length: 6 }, (_, index) => ({
      ...item(String(index)),
      name: `库${index}`,
    }));
    const groups = groupAggregateLatestFolders(
      [
        { server: server('a'), items: folders },
        { server: server('b'), items: [folders[0]] },
      ],
      { a: ['0'] },
    );
    expect(
      groups.flatMap((group) =>
        group.folders.map(({ server, folder }) => `${server.id}:${folder.id}`),
      ),
    ).toEqual(['a:1', 'a:2', 'a:3', 'a:4', 'b:0']);
    expect(groupAggregateLatestFolders([], {})).toEqual([]);
  });
  it('keeps duplicate media IDs from different accounts and retains their playback source', () => {
    const a = server('a');
    const b = server('b');
    const entries = mergeAggregateHomeItems(
      [
        { server: a, items: [item('same'), item('a2'), item('same')] },
        { server: b, items: [item('same'), item('b2')] },
      ],
      'resume',
    );
    expect(entries.map((entry) => entry.key)).toEqual(['a:same', 'b:same', 'a:a2', 'b:b2']);
    expect(entries[1].server).toBe(b);
  });

  it('orders recent additions across servers and tolerates missing or invalid dates', () => {
    const entries = mergeAggregateHomeItems(
      [
        { server: server('a'), items: [item('old', '2026-01-01'), item('missing')] },
        { server: server('b'), items: [item('new', '2026-10-11'), item('bad', 'invalid')] },
      ],
      'latest',
      3,
    );
    expect(entries.map((entry) => entry.item.id)).toEqual(['new', 'old', 'missing']);
    expect(mergeAggregateHomeItems([], 'latest')).toEqual([]);
  });

  it('loads accounts independently so a failed server does not discard successful results', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const adapter = {
      getItemAncestors: vi.fn(async () => [item('visible')]),
      getResumeItems: vi.fn(async ({ userId }: { userId: string }) => {
        if (userId === 'user-b') throw new Error('offline');
        return { items: [item('resume')] };
      }),
      getNextUpItems: vi.fn(async () => ({ items: [] })),
      getLatestItems: vi.fn(async () => ({ items: [] })),
    };
    const settled = await Promise.allSettled(
      ['a', 'b'].map((id) =>
        client.fetchQuery({
          ...homeResumeQueryOptions({
            adapter: adapter as unknown as MediaAdapter,
            currentServer: server(id),
            libraryIds: ['visible'],
            queryClient: client,
          }),
          retry: false,
        }),
      ),
    );
    expect(settled.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    const successful = settled[0];
    expect(successful.status === 'fulfilled' && successful.value[0].id).toBe('resume');
    client.clear();
  });
});
