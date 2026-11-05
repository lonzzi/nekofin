import { rememberPlaybackEpisode } from '@/services/media/playbackEpisode';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import type { MediaItem, MediaServerInfo } from '@/services/media/types';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEpisodeSelection } from './useEpisodeSelection';

type Choice = { seasonId: string; episodeId?: string };
const state = vi.hoisted(() => ({
  client: null as unknown as QueryClient,
  focused: true,
  choice: undefined as Choice | undefined,
  playbackRef: undefined as { current: unknown } | undefined,
  effectDeps: undefined as readonly unknown[] | undefined,
  effects: [] as (() => void)[],
  dirty: false,
}));
const server = { id: 'server-1', userId: 'user-1' } as MediaServerInfo;
vi.mock('@/hooks/useMediaAdapter', () => ({ useMediaAdapter: () => ({}) }));
vi.mock('@/lib/contexts/MediaServerContext', () => ({
  useMediaServers: () => ({ currentServer: { id: 'server-1', userId: 'user-1' } }),
}));
vi.mock('expo-router/react-navigation', () => ({ useIsFocused: () => state.focused }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useCallback: (callback: unknown) => callback,
  useState: (initialize: () => Choice) => {
    state.choice ??= initialize();
    return [
      state.choice,
      (update: Choice | ((previous: Choice) => Choice)) => {
        const next = typeof update === 'function' ? update(state.choice!) : update;
        state.dirty ||= next !== state.choice;
        state.choice = next;
      },
    ];
  },
  useRef: (value: unknown) => (state.playbackRef ??= { current: value }),
  useEffect: (effect: () => void, deps: readonly unknown[]) => {
    if (
      state.effectDeps &&
      deps.every((value, index) => Object.is(value, state.effectDeps![index]))
    )
      return;
    state.effectDeps = deps;
    state.effects.push(effect);
  },
}));
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => ({
    data: state.client.getQueryData(queryKey),
    dataUpdatedAt: state.client.getQueryState(queryKey)?.dataUpdatedAt ?? 0,
  }),
}));
vi.mock('@/hooks/useQueryWithFocus', () => ({
  useQueryWithFocus: ({
    queryKey,
    initialData,
  }: {
    queryKey: readonly unknown[];
    initialData?: MediaItem[];
  }) => {
    const data = state.client.getQueryData<MediaItem[]>(queryKey) ?? initialData;
    return {
      data,
      dataUpdatedAt: state.client.getQueryState(queryKey)?.dataUpdatedAt ?? (initialData ? 1 : 0),
      isPending: data === undefined,
      isError: false,
      refetch: vi.fn(),
    };
  },
}));

const episode = (id: string, seasonId = 'season-1'): MediaItem => ({
  id,
  name: id,
  type: 'Episode',
  seriesId: 'series-1',
  seasonId,
  raw: {},
});
const first = episode('episode-1');
const next = episode('episode-2');
const secondSeason = episode('episode-3', 'season-2');
const seasons = [
  { id: 'season-1', name: 'Season 1', indexNumber: 1, type: 'Season', raw: {} },
  { id: 'season-2', name: 'Season 2', indexNumber: 2, type: 'Season', raw: {} },
] satisfies MediaItem[];
const series = { id: 'series-1', name: 'Series', type: 'Series', raw: {} } satisfies MediaItem;

function render(props: Parameters<typeof useEpisodeSelection>[0]) {
  for (let attempt = 0; attempt < 5; attempt++) {
    state.dirty = false;
    // The mocked hook runtime above treats each round as a new render and effect flush.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useEpisodeSelection(props);
    state.effects.splice(0).forEach((effect) => effect());
    if (!state.dirty) return result;
  }
  throw new Error('Episode selection did not settle');
}

function cacheEpisodes(seasonId: string, episodes: MediaItem[], updatedAt = 1) {
  state.client.setQueryData(mediaQueryKeys.episodes(server.id, seasonId, server.userId), episodes, {
    updatedAt,
  });
}

function play(item: MediaItem, session = item.id) {
  rememberPlaybackEpisode({
    client: state.client,
    server,
    item,
    playSessionId: session,
    positionMs: 0,
    started: true,
  });
}

beforeEach(() => {
  state.client = new QueryClient();
  state.focused = true;
  state.choice = undefined;
  state.playbackRef = undefined;
  state.effectDeps = undefined;
  state.effects = [];
  cacheEpisodes('season-1', [first, next]);
  cacheEpisodes('season-2', [secondSeason]);
});
afterEach(() => state.client.clear());

describe('detail episode selection flow', () => {
  it('opens a series on the server next-up episode and allows direct season/episode choices', () => {
    const props = { item: series, seasons, nextUpItems: [secondSeason] };
    let detail = render(props);
    expect(detail.selectedSeasonId).toBe('season-2');
    expect(detail.selectedEpisode?.id).toBe(secondSeason.id);
    detail.selectSeason('season-1');
    detail = render(props);
    expect(detail.selectedEpisode?.id).toBe(first.id);
    detail.selectEpisode(next);
    expect(render(props).selectedEpisode?.id).toBe(next.id);
  });

  it('reconciles a cached next-up episode after the server refreshes it', () => {
    const props = { item: series, seasons, nextUpItems: [first] };
    expect(render(props).selectedEpisode?.id).toBe(first.id);
    expect(render({ ...props, nextUpItems: [next] }).selectedEpisode?.id).toBe(next.id);
  });

  it('follows refreshed next-up into another season while its episodes load', () => {
    const props = { item: series, seasons, nextUpItems: [first] };
    render(props);
    state.client.removeQueries({
      queryKey: mediaQueryKeys.episodes(server.id, 'season-2', server.userId),
    });
    const refreshedProps = { ...props, nextUpItems: [secondSeason] };
    let detail = render(refreshedProps);
    expect(detail.selectedSeasonId).toBe('season-2');
    expect(detail.selectedEpisode?.id).toBe(secondSeason.id);
    expect(detail.isPending).toBe(true);
    cacheEpisodes('season-2', [secondSeason]);
    detail = render(refreshedProps);
    expect(detail.displayEpisodes).toEqual([secondSeason]);
    expect(detail.selectedEpisode?.id).toBe(secondSeason.id);
  });

  it('uses next-up when it first arrives after the page opens', () => {
    const props = { item: series, seasons };
    expect(render(props).selectedEpisode?.id).toBe(first.id);
    expect(render({ ...props, nextUpItems: [secondSeason] }).selectedEpisode?.id).toBe(
      secondSeason.id,
    );
  });

  it('keeps an explicit episode choice when next-up refreshes', () => {
    const props = { item: series, seasons, nextUpItems: [first] };
    render(props).selectEpisode(next);
    const detail = render({ ...props, nextUpItems: [secondSeason] });
    expect(detail.selectedSeasonId).toBe('season-1');
    expect(detail.selectedEpisode?.id).toBe(next.id);
  });

  it.each(['season-1', 'season-2'])('keeps an explicit %s choice when next-up refreshes', (id) => {
    const props = { item: series, seasons, nextUpItems: [first] };
    render(props).selectSeason(id);
    const refreshed = id === 'season-1' ? secondSeason : next;
    const detail = render({ ...props, nextUpItems: [refreshed] });
    expect(detail.selectedSeasonId).toBe(id);
    expect(detail.selectedEpisode?.id).toBe(id === 'season-1' ? first.id : secondSeason.id);
  });

  it('reconciles next-up on return without changing a hidden detail selection', () => {
    const props = { item: series, seasons, nextUpItems: [first] };
    render(props);
    state.focused = false;
    const refreshedProps = { ...props, nextUpItems: [secondSeason] };
    expect(render(refreshedProps).selectedEpisode?.id).toBe(first.id);
    state.focused = true;
    expect(render(refreshedProps).selectedEpisode?.id).toBe(secondSeason.id);
  });

  it('keeps the local playback choice ahead of refreshed next-up data', () => {
    play(next);
    const props = { item: series, seasons, nextUpItems: [first] };
    expect(render(props).selectedEpisode?.id).toBe(next.id);
    expect(render({ ...props, nextUpItems: [secondSeason] }).selectedEpisode?.id).toBe(next.id);
  });

  it('keeps an explicit episode link when next-up refreshes', () => {
    const props = { item: first, seasons, nextUpItems: [next] };
    render(props);
    expect(render({ ...props, nextUpItems: [secondSeason] }).selectedEpisode?.id).toBe(first.id);
  });

  it('still follows new playback after an explicit episode choice', () => {
    const props = { item: series, seasons, nextUpItems: [first] };
    render(props).selectEpisode(next);
    state.focused = false;
    play(secondSeason);
    expect(render(props).selectedEpisode?.id).toBe(next.id);
    state.focused = true;
    expect(render(props).selectedEpisode?.id).toBe(secondSeason.id);
  });

  it('follows the next played episode on return without changing hidden detail selection', () => {
    const props = { item: first, seasons };
    expect(render(props).selectedEpisode?.id).toBe(first.id);
    state.focused = false;
    play(first);
    play(next);
    rememberPlaybackEpisode({
      client: state.client,
      server,
      item: next,
      playSessionId: next.id,
      positionMs: 45_000,
    });
    expect(render(props).selectedEpisode?.id).toBe(first.id);
    state.focused = true;
    const detail = render(props);
    expect(detail.selectedEpisode?.id).toBe(next.id);
    expect(detail.selectedEpisode?.userData?.playbackPositionTicks).toBe(450_000_000);
  });

  it('changes seasons when playback moved and keeps the target while that season loads', () => {
    const props = { item: first, seasons };
    render(props);
    state.focused = false;
    play(secondSeason);
    state.client.removeQueries({
      queryKey: mediaQueryKeys.episodes(server.id, 'season-2', server.userId),
    });
    render(props);
    state.focused = true;
    let detail = render(props);
    expect(detail.selectedSeasonId).toBe('season-2');
    expect(detail.selectedEpisode?.id).toBe(secondSeason.id);
    expect(detail.isPending).toBe(true);
    cacheEpisodes('season-2', [secondSeason]);
    detail = render(props);
    expect(detail.displayEpisodes.map((item) => item.id)).toEqual([secondSeason.id]);
    detail.selectSeason('season-1');
    expect(render(props).selectedSeasonId).toBe('season-1');
  });

  it('honors explicit episode links even with an older resume choice for the series', () => {
    play(next);
    expect(render({ item: first, seasons }).selectedEpisode?.id).toBe(first.id);
  });

  it('refreshes selected episode progress when a newer server response arrives', () => {
    const props = { item: first, seasons };
    render(props);
    const refreshed = { ...first, userData: { playbackPositionTicks: 600_000_000 } };
    cacheEpisodes('season-1', [refreshed, next], Date.now() + 1);
    expect(render(props).selectedEpisode).toEqual(refreshed);
  });

  it('does not offer the previous season episode when the new season is empty', () => {
    const props = { item: first, seasons };
    render(props).selectSeason('season-2');
    cacheEpisodes('season-2', []);
    expect(render(props).selectedEpisode).toBeUndefined();
  });
});
