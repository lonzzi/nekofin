import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmbyAdapter } from './embyAdapter';

vi.mock('@/lib/utils', () => ({
  getDeviceId: () => 'device-1',
}));

describe('EmbyAdapter instance client', () => {
  it('loads ancestry with the bound account and maps ancestor IDs', async () => {
    const fetchMock = vi.fn(
      async (_input: unknown) =>
        new Response(
          JSON.stringify([{ Id: 'library', Name: 'Movies', Type: 'CollectionFolder' }]),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new EmbyAdapter();
    adapter.setApi({ basePath: 'https://emby.test', accessToken: 'test-token' });
    expect(await adapter.getItemAncestors({ userId: 'user', itemId: 'series' })).toMatchObject([
      { id: 'library', name: 'Movies' },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://emby.test/Items/series/Ancestors?UserId=user',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the bound api when building requests', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ServerName: 'Bound Emby',
          Version: '4.8.0',
          OperatingSystem: 'Linux',
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new EmbyAdapter();
    adapter.setApi({
      basePath: 'https://bound.emby.test',
      accessToken: 'bound-token',
    });

    await expect(adapter.getSystemInfo()).resolves.toEqual({
      serverName: 'Bound Emby',
      version: '4.8.0',
      operatingSystem: 'Linux',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bound.emby.test/System/Info/Public',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Emby-Token': 'bound-token',
        }),
        method: 'GET',
      }),
    );
  });

  it('requires an adapter-bound api instance', async () => {
    await expect(new EmbyAdapter().getSystemInfo()).rejects.toThrow('API instance not set');
  });

  it.each([
    ['reportPlaybackStart', '/Sessions/Playing'],
    ['reportPlaybackProgress', '/Sessions/Playing/Progress'],
    ['reportPlaybackStop', '/Sessions/Playing/Stopped'],
  ] as const)('includes the actual version in %s', async (method, path) => {
    const fetchMock = vi.fn(
      async (_input: unknown, _init?: RequestInit) => new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new EmbyAdapter();
    adapter.setApi({ basePath: 'https://emby.test', accessToken: 'token-1' });
    await adapter[method]({
      itemId: 'item-8',
      mediaSourceId: 'mediasource_9',
      positionTicks: 1200,
      PlaySessionId: 'session-1',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://emby.test${path}`);
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toMatchObject({
      ItemId: 'item-8',
      MediaSourceId: 'mediasource_9',
      PositionTicks: 12000000,
      PlaySessionId: 'session-1',
    });
  });

  it('preserves the requested version, external subtitles and playback session', async () => {
    const source = {
      Id: 'version-two',
      Name: '720p',
      MediaStreams: [
        {
          Type: 'Subtitle',
          Index: 4,
          Codec: 'srt',
          IsExternal: true,
          DeliveryMethod: 'External',
          DeliveryUrl: '/sub.srt',
        },
      ],
    };
    const fetchMock = vi.fn(
      async (_input: unknown, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            PlaySessionId: 'new-session',
            MediaSources: [{ Id: 'version-one' }, source],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new EmbyAdapter();
    adapter.setApi({ basePath: 'https://emby.test', accessToken: 'token-1' });
    const result = await adapter.getStreamInfo({
      item: { id: 'movie-1', name: 'Movie', type: 'Movie', raw: { Id: 'movie-1' } },
      userId: 'user-1',
      startTimeTicks: 0,
      deviceProfile: {},
      mediaSourceId: 'version-two',
    });
    expect(result?.mediaSource).toEqual(source);
    expect(new URL(result!.url!).searchParams.get('mediaSourceId')).toBe('version-two');
    expect(new URL(result!.url!).searchParams.get('playSessionId')).toBe('new-session');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({
      MediaSourceId: 'version-two',
    });
  });

  it.each([
    { ErrorCode: 'NoCompatibleStream', MediaSources: [{ Id: 'chosen' }] },
    { MediaSources: [] },
    { MediaSources: [{ Id: 'another-version' }] },
  ])('rejects unsuccessful negotiation without reusing another version: %j', async (data) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })),
    );
    const adapter = new EmbyAdapter();
    adapter.setApi({ basePath: 'https://emby.test', accessToken: 'token-1' });
    await expect(
      adapter.getStreamInfo({
        item: { id: 'movie-1', name: 'Movie', type: 'Movie', raw: { Id: 'movie-1' } },
        userId: 'user-1',
        startTimeTicks: 0,
        deviceProfile: {},
        mediaSourceId: 'chosen',
        audioStreamIndex: 2,
        subtitleStreamIndex: 5,
      }),
    ).rejects.toThrow();
  });

  it('normalizes paged item responses into MediaPage', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          Items: [
            {
              Id: 'movie-1',
              Name: 'Movie One',
              Type: 'Movie',
            },
          ],
          TotalRecordCount: 5,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new EmbyAdapter();
    adapter.setApi({
      basePath: 'https://emby.test',
      accessToken: 'token-1',
    });

    const page = await adapter.getLatestItems({
      userId: 'user-1',
      limit: 1,
      includeItemTypes: ['Movie'],
    });

    expect(page).toMatchObject({
      items: [
        {
          id: 'movie-1',
          name: 'Movie One',
          type: 'Movie',
        },
      ],
      total: 5,
    });
  });
});
