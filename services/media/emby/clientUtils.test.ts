import { describe, expect, it, vi } from 'vitest';

import { createEmbyHeaders, wrapEmbyResponse } from './clientUtils';

describe('createEmbyHeaders', () => {
  it('adds Emby client metadata and token headers', () => {
    expect(
      createEmbyHeaders({ basePath: 'https://emby.test', accessToken: 'token-1' }, 'device-1', {
        'Content-Type': 'application/json',
      }),
    ).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Emby-Client': 'Nekofin',
      'X-Emby-Device-Name': 'Nekofin Device',
      'X-Emby-Device-Id': 'device-1',
      'X-Emby-Client-Version': '1.0.0',
      'X-Emby-Language': 'zh-cn',
      'X-Emby-Token': 'token-1',
    });
  });
});

describe('wrapEmbyResponse', () => {
  it('wraps JSON responses into the app api response shape', async () => {
    const result = await wrapEmbyResponse(
      new Response(JSON.stringify({ Name: 'Nekofin' }), { status: 200 }),
    );

    expect(result).toEqual({ code: 200, data: { Name: 'Nekofin' }, msg: 'ok' });
  });

  it('wraps empty responses as successful null payloads', async () => {
    const result = await wrapEmbyResponse(new Response('', { status: 200 }));

    expect(result).toEqual({ code: 200, data: null, msg: 'ok' });
  });

  it('passes through failed HTTP responses', async () => {
    const response = new Response('failed', { status: 500 });

    await expect(wrapEmbyResponse(response)).resolves.toBe(response);
  });

  it('keeps malformed JSON responses non-fatal for legacy endpoints', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await wrapEmbyResponse(new Response('not json', { status: 200 }));

    expect(result).toEqual({ code: 200, data: null, msg: 'ok' });
    consoleSpy.mockRestore();
  });
});
