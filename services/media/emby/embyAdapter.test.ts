import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmbyAdapter } from './embyAdapter';

vi.mock('@/lib/utils', () => ({
  getDeviceId: () => 'device-1',
}));

describe('EmbyAdapter instance client', () => {
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
