import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaAdapter, MediaItem, MediaServerInfo } from '@/services/media/types';
import {
  QueriesObserver,
  QueryClient,
  type QueriesObserverOptions,
  type QueryObserverOptions,
} from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useAggregateViewAll } from './useAggregateViewAll';

const state = vi.hoisted(() => ({
  memoIndex: 0,
  memos: [] as { deps: readonly unknown[]; value: unknown }[],
  observerIndex: 0,
  observers: [] as QueriesObserver<unknown>[],
  client: null as unknown as QueryClient,
  adapter: null as unknown as MediaAdapter,
  hidden: {} as Record<string, string[]>,
  focus: null as unknown as {
    isStale: boolean;
    fetchStatus: string;
    refetch: () => Promise<unknown>;
  },
  translate: (key: string, params?: { value?: string }) => `${key}:${params?.value ?? ''}`,
}));

vi.mock('react', () => {
  const memo = (factory: () => unknown, deps: readonly unknown[]) => {
    const index = state.memoIndex++;
    const previous = state.memos[index];
    if (
      previous &&
      deps.length === previous.deps.length &&
      deps.every((v, i) => Object.is(v, previous.deps[i]))
    )
      return previous.value;
    const value = factory();
    state.memos[index] = { deps, value };
    return value;
  };
  return {
    useMemo: memo,
    useCallback: (fn: () => unknown, deps: readonly unknown[]) => memo(() => fn, deps),
  };
});
vi.mock('@tanstack/react-query', async (original) => {
  const actual = await original<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => state.client,
    useQueries: ({
      queries,
      combine,
    }: {
      queries: QueryObserverOptions[];
      combine: QueriesObserverOptions<unknown>['combine'];
    }) => {
      const index = state.observerIndex++;
      const observer = (state.observers[index] ??= new actual.QueriesObserver<unknown>(
        state.client,
        [],
      ));
      const defaults = queries.map((options) => state.client.defaultQueryOptions(options));
      observer.setQueries(defaults);
      const [results, getCombined] = observer.getOptimisticResult(defaults, combine);
      return getCombined(results);
    },
  };
});
vi.mock('@/lib/i18n', () => ({
  t: state.translate,
  useTranslation: () => ({ t: state.translate }),
}));
vi.mock('@/hooks/useHiddenUserViews', () => ({ useHiddenUserViews: () => state.hidden }));
vi.mock('@/hooks/useRefetchOnScreenFocus', () => ({
  useRefetchOnScreenFocus: (focus: typeof state.focus) => {
    state.focus = focus;
  },
}));
vi.mock('./useMediaServerSources', async () => {
  const { useMemo } = await import('react');
  return {
    useMediaServerSources: (servers: MediaServerInfo[]) =>
      useMemo(() => servers.map((server) => ({ server, adapter: state.adapter })), [servers]),
  };
});

const server = (id: string): MediaServerInfo => ({
  id,
  name: id,
  type: 'jellyfin',
  address: 'https://test.invalid',
  userId: `user-${id}`,
  username: id,
  userAvatar: '',
  accessToken: '',
  createdAt: 0,
});
const item = (id: string, extra: Partial<MediaItem> = {}): MediaItem => ({
  id,
  name: id,
  type: 'Episode',
  raw: {},
  ...extra,
});
const servers = [server('one'), server('two')];
function options(account: MediaServerInfo) {
  const common = { adapter: state.adapter, currentServer: account };
  const scope = {
    ...common,
    libraryIds: [`library-${account.id}`],
    queryClient: state.client,
    limit: 40,
  };
  return {
    libraries: homeUserViewsQueryOptions(common),
    resume: homeResumeQueryOptions(scope),
    nextup: homeNextUpQueryOptions(scope),
    latest: homeLatestByFolderQueryOptions({
      ...common,
      folderId: `library-${account.id}`,
      limit: 40,
    }),
  };
}
function useView(type = 'resume', accounts = servers) {
  state.memoIndex = 0;
  state.observerIndex = 0;
  return useAggregateViewAll({ servers: accounts, type, sectionKey: 'latest:tvshows:Anime' });
}

beforeEach(() => {
  state.memos = [];
  state.observers = [];
  state.hidden = {};
  state.client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: Infinity } },
  });
  state.adapter = {
    getUserView: vi.fn(async ({ userId }) => [
      item(`library-${userId.slice(5)}`, { name: 'Anime', collectionType: 'tvshows' }),
    ]),
    getResumeItems: vi.fn(async () => ({ items: [] })),
    getNextUpItems: vi.fn(async () => ({ items: [] })),
    getLatestItemsByFolder: vi.fn(async () => ({ items: [] })),
  } as unknown as MediaAdapter;
  for (const account of servers) {
    const q = options(account);
    state.client.setQueryData(q.libraries.queryKey, [
      item(`library-${account.id}`, { name: 'Anime', collectionType: 'tvshows' }),
    ]);
    for (const kind of ['resume', 'nextup', 'latest'] as const)
      state.client.setQueryData(q[kind].queryKey, [item(`${kind}-${account.id}`)]);
  }
});
afterEach(() => {
  state.observers.forEach((observer) => observer.destroy());
  state.client.clear();
});

it('retains item arrays and account sources when a focus refetch only changes query status', async () => {
  const initial = useView();
  const source = initial.getItemSource(initial.items[0]);
  const q = options(servers[0]).resume;
  await state.client.invalidateQueries({ queryKey: q.queryKey, refetchType: 'none' });
  state.client
    .getQueryCache()
    .find({ queryKey: q.queryKey })!
    .setState({ fetchStatus: 'fetching' });
  const fetching = useView();
  expect(state.focus.isStale).toBe(true);
  expect(state.focus.fetchStatus).toBe('fetching');
  expect(fetching.items).toBe(initial.items);
  expect(fetching.getItemSource).toBe(initial.getItemSource);
  expect(fetching.getItemSource(fetching.items[0])).toBe(source);
});

it('updates watch progress without replacing the other account source', () => {
  const initial = useView();
  const otherSource = initial.getItemSource(initial.items[1]);
  state.client.setQueryData(options(servers[0]).resume.queryKey, [
    item('resume-one', { userData: { playbackPositionTicks: 500 } }),
  ]);
  const updated = useView();
  expect(updated.items[0].userData?.playbackPositionTicks).toBe(500);
  expect(updated.getItemSource(updated.items[1])).toBe(otherSource);
  expect(updated.items.map((entry) => updated.getItemSource(entry)?.server.id)).toEqual([
    'one',
    'two',
  ]);
});

it('sorts latest additions without merging matching IDs from different accounts', () => {
  state.client.setQueryData(options(servers[0]).latest.queryKey, [
    item('same', { dateCreated: '2026-10-01' }),
  ]);
  state.client.setQueryData(options(servers[1]).latest.queryKey, [
    item('same', { dateCreated: '2026-10-02' }),
  ]);
  const latest = useView('latest');
  expect(latest.items.map((entry) => latest.getItemSource(entry)?.server.id)).toEqual([
    'two',
    'one',
  ]);
  expect(latest.title).toBe('home.recentlyAddedInLibrary:Anime');
  expect(useView('latest', [servers[0]]).items).toHaveLength(1);
});

it('removes hidden libraries from the selected latest section', () => {
  expect(useView('latest').items).toHaveLength(2);
  state.hidden = { one: ['library-one'] };
  const latest = useView('latest');
  expect(latest.items.map((entry) => latest.getItemSource(entry)?.server.id)).toEqual(['two']);
});

it('keeps the view-all page size when explicitly refreshing', async () => {
  const latest = useView('latest');
  await latest.refetch();
  expect(state.adapter.getLatestItemsByFolder).toHaveBeenCalledTimes(2);
  expect(state.adapter.getLatestItemsByFolder).toHaveBeenCalledWith({
    userId: 'user-one',
    folderId: 'library-one',
    limit: 40,
  });
  expect(state.adapter.getLatestItemsByFolder).toHaveBeenCalledWith({
    userId: 'user-two',
    folderId: 'library-two',
    limit: 40,
  });
  expect(useView('latest').items).toHaveLength(0);
});
