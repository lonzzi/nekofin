import { describe, expect, it } from 'vitest';

import {
  isUpdatePromptRoute,
  resolveBuildReleaseTag,
  resolveInstalledRelease,
  selectAppUpdate,
} from './appUpdates';

function release(
  tag: string,
  options: { prerelease?: boolean; draft?: boolean; platform?: 'ios' | 'android' } = {},
) {
  const platform = options.platform ?? 'ios';
  return {
    tag_name: tag,
    prerelease: options.prerelease ?? tag.includes('-'),
    draft: options.draft ?? false,
    assets: [
      {
        name: `nekofin-${tag}-${platform === 'ios' ? 'ios-unsigned.ipa' : 'android-arm64.apk'}`,
        size: 100,
        state: 'uploaded',
      },
    ],
  };
}

describe('installed release identity', () => {
  it('preserves the beta tag only when it belongs to the installed native version', () => {
    expect(resolveInstalledRelease('0.1.0', 'v0.1.0-beta.2')).toBe('0.1.0-beta.2');
    expect(resolveInstalledRelease('0.1.0', 'v0.2.0-beta.2')).toBe('0.1.0');
    expect(resolveInstalledRelease('0.1.0', undefined)).toBe('0.1.0');
    expect(resolveInstalledRelease(null, 'v0.1.0-beta.2')).toBeNull();
  });

  it('rejects invalid or mismatched build metadata rather than shipping a wrong channel', () => {
    expect(resolveBuildReleaseTag('0.1.0', undefined)).toBeNull();
    expect(resolveBuildReleaseTag('0.1.0', 'v0.1.0-beta.1+build.2')).toBe('v0.1.0-beta.1+build.2');
    for (const tag of ['nightly', 'v0.2.0', 'v0.1.0-beta.01', 'vv0.1.0', 'v0.1.0\n', 'v 0.1.0']) {
      expect(() => resolveBuildReleaseTag('0.1.0', tag)).toThrow(/must match/);
    }
  });
});

describe('update selection', () => {
  it('keeps stable users on stable releases and sorts by version instead of API order', () => {
    const update = selectAppUpdate(
      [release('v0.2.0'), release('v0.11.0'), release('v0.3.0'), release('v1.0.0-beta.1')],
      '0.1.0',
      'ios',
    );
    expect(update?.version).toBe('0.11.0');
  });

  it.each([
    ['0.2.0-beta.1', ['v0.2.0-beta.2', 'v0.2.0-beta.10'], '0.2.0-beta.10'],
    ['0.2.0-beta.10', ['v0.2.0-rc.1', 'v0.2.0'], '0.2.0'],
    ['0.2.0-rc.1', ['v0.2.0-beta.10', 'v0.2.0-rc.1'], null],
    ['0.2.0', ['v0.2.0', 'v0.1.9', 'v0.2.0+build.2'], null],
  ])('compares prerelease progression from %s', (current, tags, expected) => {
    expect(
      selectAppUpdate(
        tags.map((tag) => release(tag)),
        current,
        'ios',
      )?.version ?? null,
    ).toBe(expected);
  });

  it('requires an uploaded nonempty installer for the current platform', () => {
    const empty = release('v0.7.0');
    empty.assets[0].size = 0;
    const uploading = release('v0.6.0');
    uploading.assets[0].state = 'new';
    expect(
      selectAppUpdate(
        [release('v0.8.0', { platform: 'android' }), empty, uploading, release('v0.5.0')],
        '0.1.0',
        'ios',
      )?.version,
    ).toBe('0.5.0');
    expect(
      selectAppUpdate([release('v0.8.0', { platform: 'android' })], '0.1.0', 'android')?.version,
    ).toBe('0.8.0');
  });

  it('excludes nightly, draft, malformed and mislabeled releases', () => {
    expect(
      selectAppUpdate(
        [
          release('nightly'),
          release('v0.3.0', { draft: true }),
          release('v0.3.0-beta.1', { prerelease: false }),
          release('v0.3.0', { prerelease: true }),
          release('vv0.3.0'),
          release('v0.3.0\n'),
          null,
          {},
          { tag_name: 'v0.4.0' },
        ],
        '0.1.0-beta.1',
        'ios',
      ),
    ).toBeNull();
  });

  it('constructs the destination from the repository and selected tag', () => {
    const item = { ...release('v0.2.0'), html_url: 'https://other.example/download' };
    expect(selectAppUpdate([item], '0.1.0', 'ios')?.url).toBe(
      'https://github.com/lonzzi/nekofin/releases/tag/v0.2.0',
    );
  });

  it('does not turn missing local version metadata into an update recommendation', () => {
    expect(() => selectAppUpdate([], 'unknown', 'ios')).toThrow(/当前应用版本/);
  });
});

it.each(['/player', '/player/123', '/player-lab', '/player-lab/preview'])(
  'defers update prompts on %s',
  (pathname) => {
    expect(isUpdatePromptRoute(pathname)).toBe(false);
  },
);

it.each(['/', '/about', '/settings', '/detail/123'])('allows update prompts on %s', (pathname) => {
  expect(isUpdatePromptRoute(pathname)).toBe(true);
});
