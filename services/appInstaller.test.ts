import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  start: vi.fn(),
  refresh: vi.fn(),
  cancel: vi.fn(),
  playing: vi.fn(),
  prepare: vi.fn(),
  install: vi.fn(),
  available: true,
  platform: 'android',
  sources: undefined as string[] | undefined,
}));
vi.mock('expo', () => ({
  requireOptionalNativeModule: () =>
    state.available
      ? {
          startDownloadAsync: state.start,
          getDownloadAsync: state.refresh,
          cancelDownloadAsync: state.cancel,
          setPlaybackActiveAsync: state.playing,
          prepareInstallAsync: state.prepare,
          installApkAsync: state.install,
          supportedUpdateSources: state.sources,
        }
      : null,
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));
const tag = 'v0.1.0-beta.4';
const name = `nekofin-${tag}-android-arm64.apk`;
const release = {
  tag,
  version: tag.slice(1),
  url: `https://github.com/lonzzi/nekofin/releases/tag/${tag}`,
  installer: {
    name,
    url: `https://github.com/lonzzi/nekofin/releases/download/${tag}/${name}`,
    size: 100,
    sha256: 'a'.repeat(64),
  },
};
const download = {
  release: JSON.stringify(release),
  automatic: true,
  status: 'downloading' as const,
  progress: 20,
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  state.available = true;
  state.platform = 'android';
  state.sources = undefined;
  state.start.mockResolvedValue(download);
  state.refresh.mockResolvedValue(download);
  state.cancel.mockResolvedValue(undefined);
  state.playing.mockResolvedValue(undefined);
  state.prepare.mockResolvedValue('file:///update.apk');
  state.install.mockResolvedValue('opened');
});

describe('system-owned Android downloads', () => {
  it('uses native capability detection to keep older APKs on a manual CNB fallback', async () => {
    let api = await import('./appInstaller');
    expect(api.supportsInstallerSource('github')).toBe(true);
    expect(api.supportsInstallerSource('cnb')).toBe(false);
    state.sources = ['github', 'cnb'];
    vi.resetModules();
    api = await import('./appInstaller');
    expect(api.supportsInstallerSource('cnb')).toBe(true);
  });
  it('restores CNB downloads only with the correct canonical URL and a SHA256', async () => {
    const { parseInstallerDownload } = await import('./appInstaller');
    const cnb = {
      ...release,
      source: 'cnb',
      url: `https://cnb.cool/lonzzi/nekofin/-/releases/tag/${tag}`,
      installer: {
        ...release.installer,
        url: `https://cnb.cool/lonzzi/nekofin/-/releases/download/${tag}/${name}`,
      },
    };
    expect(parseInstallerDownload({ ...download, release: JSON.stringify(cnb) })).toMatchObject({
      release: cnb,
    });
    for (const installer of [{ ...cnb.installer, sha256: null }, release.installer])
      expect(
        parseInstallerDownload({ ...download, release: JSON.stringify({ ...cnb, installer }) }),
      ).toBeNull();
  });
  it('starts a durable automatic task and restores progress without starting another task', async () => {
    const api = await import('./appInstaller');
    expect(await api.startAppInstallerDownload(release, true)).toMatchObject({
      release,
      progress: 20,
    });
    expect(state.start).toHaveBeenCalledWith(JSON.stringify(release), true);
    expect(await api.getAppInstallerDownload()).toMatchObject({ release, progress: 20 });
    expect(state.start).toHaveBeenCalledTimes(1);
    expect(state.install).not.toHaveBeenCalled();
  });
  it('verifies restored files off the UI thread before opening the installer', async () => {
    const api = await import('./appInstaller');
    state.prepare.mockRejectedValueOnce(new Error('corrupted file'));
    await expect(api.installAppUpdate('file:///update.apk')).rejects.toThrow(/重新下载/);
    expect(state.install).not.toHaveBeenCalled();
    await api.installAppUpdate('file:///update.apk');
    expect(state.install).toHaveBeenCalledWith('file:///update.apk');
  });
  it('forwards cancellation and playback suppression to Android', async () => {
    const api = await import('./appInstaller');
    await api.cancelAppInstallerDownload();
    await api.setInstallerPlaybackActive(true);
    expect(state.cancel).toHaveBeenCalledTimes(1);
    expect(state.playing).toHaveBeenCalledWith(true);
  });
  it('rejects corrupted persistent metadata and off-repository installer URLs', async () => {
    const { parseInstallerDownload } = await import('./appInstaller');
    expect(
      parseInstallerDownload({ ...download, status: 'ready' as const, uri: 'file:///update.apk' }),
    ).toMatchObject({ status: 'ready' });
    expect(parseInstallerDownload({ ...download, release: '{bad' } as never)).toBeNull();
    expect(
      parseInstallerDownload({
        ...download,
        release: JSON.stringify({
          ...release,
          installer: { ...release.installer, url: 'https://other.example/app.apk' },
        }),
      } as never),
    ).toBeNull();
    expect(parseInstallerDownload({ ...download, status: 'ready' } as never)).toBeNull();
  });
  it.each(['ios', 'legacy-android'])(
    'keeps %s on the browser fallback when native work is unavailable',
    async (platform) => {
      state.platform = platform === 'ios' ? 'ios' : 'android';
      state.available = false;
      const api = await import('./appInstaller');
      expect(api.canInstallAppUpdate).toBe(false);
      await expect(api.startAppInstallerDownload(release, true)).rejects.toThrow(/GitHub/);
      expect(await api.getAppInstallerDownload()).toBeNull();
    },
  );
});
