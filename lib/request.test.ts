import { afterEach, describe, expect, it, vi } from 'vitest';

import createApiClient, { ApiClientError } from './request';

describe('createApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes query params and skips nullish values', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ code: 200, data: { ok: true }, msg: 'ok' }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({ baseUrl: 'https://example.test' });
    const response = await client.get('/Items', {
      UserId: 'user-1',
      Tags: ['a', 'b'],
      Empty: undefined,
      Nil: null,
    });

    expect(response.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/Items?UserId=user-1&Tags=a&Tags=b',
      { method: 'GET' },
    );
  });

  it('lets interceptors add headers before fetch', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ code: 200, data: null, msg: 'ok' }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({ baseUrl: 'https://example.test' });
    client.addRequestInterceptor((config) => ({
      ...config,
      headers: {
        ...(config.headers as Record<string, string> | undefined),
        Authorization: 'Bearer token',
      },
    }));

    await client.post('/Users', { name: 'Neko' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/Users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Neko' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws on non-success api response codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ code: 500, data: null, msg: 'failed' }), {
          status: 200,
        });
      }),
    );

    const client = createApiClient({ baseUrl: 'https://example.test' });

    await expect(client.get('/Broken')).rejects.toThrow('API error! code: 500, message: failed');
  });

  it('throws structured errors for failed http responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(null, { status: 401 });
      }),
    );

    const client = createApiClient({ baseUrl: 'https://example.test' });

    await expect(client.get('/Unauthorized')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      url: 'https://example.test/Unauthorized',
    } satisfies Partial<ApiClientError>);
  });

  it('adds an abort signal when timeout is configured', async () => {
    const fetchMock = vi.fn(async (_url: string, _config: RequestInit) => {
      return new Response(JSON.stringify({ code: 200, data: null, msg: 'ok' }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({ baseUrl: 'https://example.test', timeoutMs: 1000 });
    await client.get('/WithTimeout');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/WithTimeout',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
