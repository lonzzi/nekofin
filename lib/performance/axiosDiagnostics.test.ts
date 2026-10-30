import { AxiosError, create } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { captureAxiosDiagnostics } from './axiosDiagnostics';

describe('Jellyfin Axios diagnostics', () => {
  it('captures successful requests, strips signed queries and detaches cleanly', async () => {
    const client = create({
      adapter: async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: {} }),
    });
    const end = vi.fn();
    const begin = vi.fn(() => ({ end }));
    const stop = captureAxiosDiagnostics(client, begin);
    await client.get('https://media.test/Items/movie', {
      params: { api_key: 'never-record', userId: 'user' },
    });
    expect(begin).toHaveBeenCalledExactlyOnceWith('GET https://media.test/Items/movie');
    expect(end).toHaveBeenCalledExactlyOnceWith('ok', 'HTTP 200');
    stop();
    await client.get('https://media.test/another');
    expect(begin).toHaveBeenCalledOnce();
  });

  it('records HTTP failures and keeps the original rejection', async () => {
    const client = create({
      adapter: async (config) => {
        throw new AxiosError('timeout', 'ETIMEDOUT', config);
      },
    });
    const end = vi.fn();
    const stop = captureAxiosDiagnostics(client, () => ({ end }));
    await expect(client.get('https://media.test/PlaybackInfo')).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
    expect(end).toHaveBeenCalledExactlyOnceWith('error', 'ETIMEDOUT: timeout');
    stop();
  });
});
