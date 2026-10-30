import { describe, expect, it, vi } from 'vitest';

import type { AppRelease } from './appUpdates';
import { selectAutomaticUpdateSource } from './automaticUpdateSources';
import { resolveUpdateSourcePreference, type UpdateSource } from './updateSources';

function release(source: UpdateSource, version = '0.2.0'): AppRelease {
  return {
    source,
    version,
    tag: `v${version}`,
    url: `https://${source}.test/v${version}`,
    installer: { name: 'app.apk', url: `https://${source}.test/app.apk`, size: 100, sha256: null },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe('automatic update source selection', () => {
  it('defaults to automatic while preserving saved manual choices', () => {
    expect(resolveUpdateSourcePreference(undefined)).toBe('auto');
    expect(resolveUpdateSourcePreference('invalid')).toBe('auto');
    for (const source of ['auto', 'github', 'cnb']) {
      expect(resolveUpdateSourcePreference(source)).toBe(source);
    }
  });

  it('starts both requests together and selects the first valid response for the same version', async () => {
    const github = deferred<AppRelease | null>();
    const cnb = deferred<AppRelease | null>();
    const fetchUpdate = vi.fn((source: UpdateSource) =>
      source === 'github' ? github.promise : cnb.promise,
    );
    const selected = selectAutomaticUpdateSource(fetchUpdate);
    expect(fetchUpdate.mock.calls.map(([source]) => source)).toEqual(['github', 'cnb']);
    cnb.resolve(release('cnb'));
    await Promise.resolve();
    github.resolve(release('github'));
    expect(await selected).toEqual({ source: 'cnb', release: release('cnb') });
  });

  it('does not hide a newer release behind a faster but stale mirror', async () => {
    const github = deferred<AppRelease | null>();
    const selected = selectAutomaticUpdateSource(async (source) =>
      source === 'github' ? github.promise : release('cnb', '0.2.0'),
    );
    await Promise.resolve();
    github.resolve(release('github', '0.3.0'));
    expect(await selected).toEqual({ source: 'github', release: release('github', '0.3.0') });
  });

  it('accepts an available update even when the faster source reports no update', async () => {
    const github = deferred<AppRelease | null>();
    const selected = selectAutomaticUpdateSource(async (source) =>
      source === 'github' ? github.promise : null,
    );
    await Promise.resolve();
    github.resolve(release('github'));
    expect((await selected).source).toBe('github');
  });

  it('keeps the fastest usable route when both sources are current', async () => {
    const github = deferred<AppRelease | null>();
    const selected = selectAutomaticUpdateSource(async (source) =>
      source === 'github' ? github.promise : null,
    );
    await Promise.resolve();
    github.resolve(null);
    expect(await selected).toEqual({ source: 'cnb', release: null });
  });

  it.each(['github', 'cnb'] as const)(
    'uses the other source if %s fails validation or times out',
    async (failed) => {
      const selected = await selectAutomaticUpdateSource(async (source) => {
        if (source === failed) throw new Error('source unavailable');
        return release(source);
      });
      expect(selected.source).toBe(failed === 'github' ? 'cnb' : 'github');
    },
  );

  it('reports failure if neither source can be checked', async () => {
    await expect(
      selectAutomaticUpdateSource(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });

  it('only checks sources supported by an older native installer', async () => {
    const fetchUpdate = vi.fn(async (source: UpdateSource) => release(source));
    expect((await selectAutomaticUpdateSource(fetchUpdate, ['github'])).source).toBe('github');
    expect(fetchUpdate).toHaveBeenCalledTimes(1);
    expect(fetchUpdate).toHaveBeenCalledWith('github');
  });
});
