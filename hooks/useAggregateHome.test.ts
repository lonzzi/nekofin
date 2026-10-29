import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeRandomQueryOptions,
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

import { useAggregateHome } from './useAggregateHome';

const state = vi.hoisted(() => ({
  memoIndex: 0,
  memos: [] as { deps: readonly unknown[]; value: unknown }[],
  observerIndex: 0,
  observers: [] as QueriesObserver<unknown>[],
  client: null as unknown as QueryClient,
  adapter: null as unknown as MediaAdapter,
  hidden: {} as Record<string, string[]>,
  carousel: {} as Record<string, string[] | null>,
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
vi.mock('@/hooks/useHomeCarouselLibraries', () => ({
  useHomeCarouselLibraries: () => state.carousel,
}));
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
  const scoped = { ...common, libraryIds: [`library-${account.id}`], queryClient: state.client };
  return {
    libraries: homeUserViewsQueryOptions(common),
    resume: homeResumeQueryOptions(scoped),
    nextup: homeNextUpQueryOptions(scoped),
    random: homeRandomQueryOptions(scoped),
    latest: homeLatestByFolderQueryOptions({ ...common, folderId: `library-${account.id}` }),
  };
}
function useHome(accounts = servers) {
  state.memoIndex = 0;
  state.observerIndex = 0;
  return useAggregateHome(accounts);
}

beforeEach(() => {
  state.memos = [];
  state.observers = [];
  state.hidden = {};
  state.carousel = {};
  state.client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: Infinity } },
  });
  state.adapter = {
    getUserView: vi.fn(async ({ userId }) => [
      item(`library-${userId.slice(5)}`, { collectionType: 'tvshows' }),
    ]),
    getResumeItems: vi.fn(async () => ({ items: [] })),
    getNextUpItems: vi.fn(async () => ({ items: [] })),
    getRandomItems: vi.fn(async () => []),
    getLatestItemsByFolder: vi.fn(async () => ({ items: [] })),
  } as unknown as MediaAdapter;
  for (const account of servers) {
    const q = options(account);
    state.client.setQueryData(q.libraries.queryKey, [
      item(`library-${account.id}`, { name: 'Anime', collectionType: 'tvshows' }),
    ]);
    for (const kind of ['resume', 'nextup', 'random', 'latest'] as const)
      state.client.setQueryData(q[kind].queryKey, [item(`${kind}-${account.id}`)]);
  }
});
afterEach(() => {
  state.observers.forEach((observer) => observer.destroy());
  state.client.clear();
});

it('retains rails, carousel and source lookup across focus/refetch status changes', async () => {
  const initial = useHome();
  const q = options(servers[0]);
  await state.client.invalidateQueries({ queryKey: q.resume.queryKey, refetchType: 'none' });
  state.client
    .getQueryCache()
    .find({ queryKey: q.resume.queryKey })!
    .setState({ fetchStatus: 'fetching' });
  const fetching = useHome();
  expect(state.focus.isStale).toBe(true);
  expect(state.focus.fetchStatus).toBe('fetching');
  expect(fetching.sections).toBe(initial.sections);
  expect(fetching.carouselItems).toBe(initial.carouselItems);
  expect(fetching.getItemSource).toBe(initial.getItemSource);
  expect(fetching.latestGroups).toBe(initial.latestGroups);
});

it('updates watch progress while retaining each account source and unchanged carousel', () => {
  const initial = useHome();
  const previousSource = initial.getItemSource(initial.sections[0].items[0]);
  state.client.setQueryData(options(servers[0]).resume.queryKey, [
    item('resume-one', { userData: { playbackPositionTicks: 500 } }),
  ]);
  const updated = useHome();
  expect(updated.sections[0].items[0].userData?.playbackPositionTicks).toBe(500);
  expect(updated.getItemSource(updated.sections[0].items[0])).toBe(previousSource);
  expect(updated.getItemSource(updated.sections[0].items[1])?.server).toBe(servers[1]);
  expect(updated.carouselItems).toBe(initial.carouselItems);
});

it('keeps matching item IDs on different accounts separate when selecting a server', () => {
  for (const account of servers)
    state.client.setQueryData(options(account).resume.queryKey, [item('same')]);
  const aggregate = useHome();
  expect(
    aggregate.sections[0].items.map((entry) => aggregate.getItemSource(entry)?.server.id),
  ).toEqual(['one', 'two']);
  const selected = useHome([servers[1]]);
  expect(selected.sections[0].items).toHaveLength(1);
  expect(selected.getItemSource(selected.sections[0].items[0])?.server).toBe(servers[1]);
});

it('updates library visibility without retaining hidden latest rows', () => {
  const initial = useHome();
  expect(initial.latestGroups[0].folders).toHaveLength(2);
  state.hidden = { one: ['library-one'] };
  const hidden = useHome();
  expect(hidden.latestGroups[0].folders.map((entry) => entry.server.id)).toEqual(['two']);
  expect(
    hidden.sections
      .find((section) => section.type === 'userview')!
      .items.map((entry) => hidden.getItemSource(entry)?.server.id),
  ).toEqual(['two']);
});

it('refetches stale focus rows without reshuffling the carousel, and refreshes all rows on demand', async () => {
  useHome();
  await state.client.invalidateQueries({
    queryKey: options(servers[0]).resume.queryKey,
    refetchType: 'none',
  });
  useHome();
  await state.focus.refetch();
  expect(state.adapter.getResumeItems).toHaveBeenCalledOnce();
  expect(state.adapter.getRandomItems).not.toHaveBeenCalled();
  const focused = useHome();
  await focused.refetch();
  expect(state.adapter.getRandomItems).toHaveBeenCalledTimes(2);
});
