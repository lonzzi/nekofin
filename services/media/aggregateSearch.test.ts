import {
  QueriesObserver,
  QueryClient,
  type QueryObserverOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aggregateSearchQueries, aggregateSearchResults } from './aggregateSearch';
import { SEARCH_TIMEOUT_MS, searchWithDeadline } from './searchRequest';
import type { MediaItem, MediaServerInfo, SearchItemsParams } from './types';

const server = (id: string): MediaServerInfo => ({
  id,
  name: `Server ${id}`,
  type: 'jellyfin',
  address: 'https://media.test',
  userId: `user-${id}`,
  username: 'test',
  userAvatar: '',
  accessToken: '',
  createdAt: 0,
});
const item = (name: string): MediaItem => ({ id: 'same-id', name, type: 'Movie', raw: {} });
type SearchSource = Parameters<typeof aggregateSearchQueries>[0]['sources'][number];
const clients: QueryClient[] = [];
const observers: QueriesObserver[] = [];

function queryPlan(sources: SearchSource[], keyword: string) {
  // The core observer erases the React helper's data and query-key generics.
  return aggregateSearchQueries({ sources, keyword }) as QueryObserverOptions[];
}

function observe(sources: SearchSource[], keyword = 'film') {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: 3, retryDelay: 10 } },
  });
  clients.push(client);
  const observer = new QueriesObserver(client, queryPlan(sources, keyword));
  observers.push(observer);
  observer.subscribe(() => {});
  return {
    client,
    observer,
    read: () =>
      aggregateSearchResults(sources, observer.getCurrentResult() as UseQueryResult<MediaItem[]>[]),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  observers.splice(0).forEach((observer) => observer.destroy());
  clients.splice(0).forEach((client) => client.clear());
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('independent server searches', () => {
  it('publishes a fast server immediately while another server never responds', async () => {
    const slow = vi.fn((_params: SearchItemsParams) => new Promise<MediaItem[]>(() => {}));
    const fast = vi.fn(async () => [item('Fast result')]);
    const view = observe([
      { server: server('slow'), adapter: { searchItems: slow } },
      { server: server('fast'), adapter: { searchItems: fast } },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(view.read().isLoading).toBe(false);
    expect(view.read().pendingServerCount).toBe(1);
    expect(view.read().groups[1].items).toEqual([item('Fast result')]);

    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
    expect(slow.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(view.read().pendingServerCount).toBe(0);
    expect(view.read().failedServers).toEqual(['Server slow']);
    expect(view.read().groups[1].items).toEqual([item('Fast result')]);
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS * 4);
    expect(slow).toHaveBeenCalledOnce();
    expect(fast).toHaveBeenCalledOnce();
  });

  it('keeps waiting when an early server is empty and another server is still searching', async () => {
    const view = observe([
      { server: server('empty'), adapter: { searchItems: vi.fn(async () => []) } },
      { server: server('pending'), adapter: { searchItems: () => new Promise(() => {}) } },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(view.read().groups.every((group) => group.items.length === 0)).toBe(true);
    expect(view.read().pendingServerCount).toBe(1);
    expect(view.read().failedServers).toEqual([]);
  });

  it('preserves matching IDs on separate servers and clears deadlines after success', async () => {
    const searchItems = vi.fn(async (_params: SearchItemsParams) => [item('Result')]);
    const view = observe(
      [
        { server: server('a'), adapter: { searchItems } },
        { server: server('b'), adapter: { searchItems } },
      ],
      '  film  ',
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(view.read().groups.map((group) => [group.source.server.id, group.items[0].id])).toEqual([
      ['a', 'same-id'],
      ['b', 'same-id'],
    ]);
    expect(searchItems).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', searchTerm: 'film', limit: 60 }),
    );
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
    expect(searchItems.mock.calls.every(([params]) => params.signal?.aborted === false)).toBe(true);
    expect(view.read().failedServers).toEqual([]);
  });

  it('cancels superseded keywords and never inserts their late results into the new search', async () => {
    let finishOld!: (items: MediaItem[]) => void;
    let oldSignal: AbortSignal | undefined;
    const sources = [
      {
        server: server('a'),
        adapter: {
          searchItems: vi.fn((params: SearchItemsParams) => {
            if (params.searchTerm === 'old') {
              oldSignal = params.signal;
              return new Promise<MediaItem[]>((resolve) => {
                finishOld = resolve;
              });
            }
            return Promise.resolve([item('New result')]);
          }),
        },
      },
    ];
    const view = observe(sources, 'old');
    await vi.advanceTimersByTimeAsync(0);
    view.observer.setQueries(queryPlan(sources, 'new'));
    await vi.advanceTimersByTimeAsync(0);
    expect(oldSignal?.aborted).toBe(true);
    expect(view.read().groups[0].items).toEqual([item('New result')]);
    finishOld([item('Old result')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(view.read().groups[0].items).toEqual([item('New result')]);
  });

  it('cancels in-flight requests immediately when search is cleared during debounce', async () => {
    let requestSignal: AbortSignal | undefined;
    const sources = [
      {
        server: server('a'),
        adapter: {
          searchItems: (params: SearchItemsParams) => {
            requestSignal = params.signal;
            return new Promise<MediaItem[]>(() => {});
          },
        },
      },
    ];
    const view = observe(sources);
    await vi.advanceTimersByTimeAsync(0);
    view.observer.setQueries(queryPlan(sources, ''));
    expect(requestSignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(view.client.isFetching()).toBe(0);
    expect(view.read().pendingServerCount).toBe(0);
  });

  it('ignores a provider resolving after its deadline even if it ignores AbortSignal', async () => {
    let finish!: (items: MediaItem[]) => void;
    const view = observe([
      {
        server: server('a'),
        adapter: {
          searchItems: () =>
            new Promise<MediaItem[]>((resolve) => {
              finish = resolve;
            }),
        },
      },
    ]);
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
    expect(view.read().failedServers).toEqual(['Server a']);
    finish([item('Late result')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(view.read().groups[0].items).toEqual([]);
    expect(view.read().failedServers).toEqual(['Server a']);
  });

  it('does not contact servers for an empty or already cancelled search', async () => {
    const searchItems = vi.fn(async () => [item('Result')]);
    const sources = [{ server: server('a'), adapter: { searchItems } }];
    expect(aggregateSearchQueries({ sources, keyword: '   ' })).toEqual([]);
    expect(aggregateSearchQueries({ sources: [], keyword: 'film' })).toEqual([]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      searchWithDeadline(
        { searchItems },
        { userId: 'user-a', searchTerm: 'film', signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(searchItems).not.toHaveBeenCalled();
  });
});
