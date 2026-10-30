import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAppUpdate } from './appUpdates';

const release = {
  tag_name: 'v0.2.0',
  draft: false,
  prerelease: false,
  assets: [{ name: 'nekofin-v0.2.0-android-arm64.apk', state: 'uploaded', size: 100 }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('GitHub update requests', () => {
  it('reads paginated public releases without credentials and finds platform updates', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { headers: { link: '<next>; rel="next"' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([release])));
    vi.stubGlobal('fetch', fetchMock);

    expect((await fetchAppUpdate('0.1.0', 'android'))?.tag).toBe('v0.2.0');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/lonzzi/nekofin/releases?per_page=100&page=2',
      { headers: { Accept: 'application/vnd.github+json' }, signal: expect.any(AbortSignal) },
    );
  });

  it.each([403, 429, 500, 404])('reports service failure for HTTP %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(fetchAppUpdate('0.1.0', 'ios')).rejects.toThrow(
      status === 403 || status === 429 ? /受限/ : /无法获取/,
    );
  });

  it('rejects invalid payloads instead of reporting that the app is current', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(fetchAppUpdate('0.1.0', 'ios')).rejects.toThrow(/无效/);
  });

  it('reports malformed JSON without exposing a parser error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>gateway error</html>')));
    await expect(fetchAppUpdate('0.1.0', 'ios')).rejects.toThrow(/无效的版本信息/);
  });

  it('bounds pagination instead of accepting a truncated release list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { headers: { link: '<next>; rel="next"' } })),
    );
    await expect(fetchAppUpdate('0.1.0', 'ios')).rejects.toThrow(/完整读取/);
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  it('aborts a stalled request and clears its timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    const assertion = expect(fetchAppUpdate('0.1.0', 'ios')).rejects.toThrow(/超时/);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports network failures in user-facing language', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    await expect(fetchAppUpdate('0.1.0', 'ios')).rejects.toThrow(/检查网络/);
  });
});

describe('CNB update requests', () => {
  const sha = 'b'.repeat(64);
  const cnbRelease = {
    ...release,
    assets: [{ name: release.assets[0].name, size: 100 }],
  };
  it('reads anonymous CNB releases and requires the installer checksum from SHA256SUMS', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([cnbRelease])))
      .mockResolvedValueOnce(new Response(`${sha}  ${release.assets[0].name}\n`));
    vi.stubGlobal('fetch', fetchMock);
    const update = await fetchAppUpdate('0.1.0', 'android', 'cnb');
    expect(update).toMatchObject({
      source: 'cnb',
      installer: {
        sha256: sha,
        url: `https://cnb.cool/lonzzi/nekofin/-/releases/download/v0.2.0/${release.assets[0].name}`,
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.cnb.cool/lonzzi/nekofin/-/releases?page_size=100&page=1',
      {
        headers: { Accept: 'application/vnd.cnb.api+json' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://cnb.cool/lonzzi/nekofin/-/releases/download/v0.2.0/SHA256SUMS',
      { signal: expect.any(AbortSignal) },
    );
  });
  it('uses CNB pagination and authenticated asset metadata without fetching a checksum file', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { headers: { 'x-cnb-total': '101' } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              ...cnbRelease,
              assets: [{ ...cnbRelease.assets[0], hash_algo: 'SHA256', hash_value: sha }],
            },
          ]),
          { headers: { 'x-cnb-total': '101' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchAppUpdate('0.1.0', 'android', 'cnb'))?.installer.sha256).toBe(sha);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
  });
  it.each([
    '',
    'invalid',
    `${sha}  other.apk`,
    `${sha}  ${release.assets[0].name}\n${sha}  ${release.assets[0].name}`,
  ])('rejects missing or ambiguous checksums', async (text) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([cnbRelease])))
        .mockResolvedValueOnce(new Response(text)),
    );
    await expect(fetchAppUpdate('0.1.0', 'android', 'cnb')).rejects.toThrow(/无效/);
  });
});
