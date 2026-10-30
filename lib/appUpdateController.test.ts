import { describe, expect, it, vi } from 'vitest';

import {
  createAppUpdateController,
  UPDATE_CHECK_INTERVAL_MS,
  type UpdatePromptActions,
} from './appUpdateController';
import type { AppRelease, InstallerDownload } from './appUpdates';
import type { UpdateSource } from './updateSources';

const update: AppRelease = {
  version: '0.2.0-beta.2',
  tag: 'v0.2.0-beta.2',
  url: 'https://github.com/lonzzi/nekofin/releases/tag/v0.2.0-beta.2',
  installer: { name: 'update.apk', url: 'https://github.com/update.apk', size: 100, sha256: null },
};

function setup({
  automaticEnabled = true,
  currentVersion = '0.2.0-beta.1' as string | null,
  resources = false,
  installer = false,
  autoDownloadEnabled = false,
  source = 'github' as UpdateSource,
  supportsSource = (_source: UpdateSource): boolean => true,
} = {}) {
  let time = 1_000;
  const values = new Map<string, number | string>();
  const fetchUpdate = vi
    .fn<(source: UpdateSource) => Promise<AppRelease | null>>()
    .mockResolvedValue(update);
  const showUpdate = vi.fn<(release: AppRelease, actions: UpdatePromptActions) => void>();
  const showMessage = vi.fn<(title: string, message: string, dismiss: () => void) => void>();
  const openURL = vi.fn().mockResolvedValue(undefined);
  const canAutoDownloadResources = vi.fn().mockResolvedValue(true);
  const resourceAPI = {
    check: vi.fn().mockResolvedValue(false),
    download: vi.fn().mockResolvedValue(true),
    apply: vi.fn().mockResolvedValue(undefined),
  };
  const installerAPI = {
    supportsSource,
    start: vi.fn().mockResolvedValue({
      release: update,
      automatic: false,
      status: 'ready',
      progress: 100,
      uri: 'file:///update.apk',
    }),
    refresh: vi.fn<() => Promise<InstallerDownload | null>>().mockResolvedValue(null),
    cancel: vi.fn().mockResolvedValue(undefined),
    install: vi.fn().mockResolvedValue('opened'),
  };
  const showResourceUpdate = vi.fn<(download: () => void, dismiss: () => void) => void>();
  const showReady =
    vi.fn<(kind: 'package' | 'resources', install: () => void, dismiss: () => void) => void>();
  const controller = createAppUpdateController({
    currentVersion,
    source,
    automaticEnabled,
    storage: {
      getNumber: (key) => values.get(key) as number | undefined,
      getString: (key) => values.get(key) as string | undefined,
      set: (key, value) => {
        values.set(key, value);
      },
    },
    fetchUpdate,
    showUpdate,
    showMessage,
    openURL,
    resources: resources ? resourceAPI : undefined,
    installer: installer ? installerAPI : undefined,
    showResourceUpdate,
    showReady,
    autoDownloadEnabled,
    canAutoDownloadResources,
    now: () => time,
  });
  return {
    controller,
    values,
    fetchUpdate,
    showUpdate,
    showMessage,
    openURL,
    resourceAPI,
    installerAPI,
    showResourceUpdate,
    showReady,
    autoDownloadEnabled,
    canAutoDownloadResources,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
  };
}

const settle = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

describe('update source coordination', () => {
  it('uses CNB for manual installer checks, resource checks and resource downloads', async () => {
    const test = setup({ source: 'cnb', automaticEnabled: false, resources: true });
    test.fetchUpdate.mockResolvedValue(null);
    test.resourceAPI.check.mockResolvedValue(true);
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    expect(test.fetchUpdate).toHaveBeenCalledWith('cnb');
    expect(test.resourceAPI.check).toHaveBeenCalledWith('cnb');
    test.showResourceUpdate.mock.calls[0][1]();
    await test.controller.downloadResources();
    expect(test.resourceAPI.download).toHaveBeenCalledWith('cnb');
  });
  it('checks the new source immediately without inheriting the other source daily throttle', async () => {
    const test = setup({ resources: true, autoDownloadEnabled: true });
    test.fetchUpdate.mockResolvedValue(null);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.controller.setSource('cnb')).toBe(true);
    test.resourceAPI.check.mockResolvedValue(true);
    await test.controller.checkAutomatically();
    await settle();
    expect(test.fetchUpdate.mock.calls.map(([source]) => source)).toEqual(['github', 'cnb']);
    expect(test.resourceAPI.download).toHaveBeenCalledWith('cnb');
    expect(test.values.has('appUpdate.lastCheckAt.0.2.0-beta.1.cnb')).toBe(true);
  });
  it('refuses source changes during requests and while a prompt is open', async () => {
    const test = setup({ automaticEnabled: false });
    let finish!: (value: AppRelease) => void;
    test.fetchUpdate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    test.controller.setCanPrompt(true);
    const checking = test.controller.checkManually();
    expect(test.controller.setSource('cnb')).toBe(false);
    await Promise.resolve();
    finish(update);
    await checking;
    expect(test.controller.setSource('cnb')).toBe(false);
    test.showUpdate.mock.calls[0][1].later();
    expect(test.controller.setSource('cnb')).toBe(true);
    expect(test.controller.getSnapshot()).toMatchObject({
      source: 'cnb',
      release: null,
      status: 'idle',
    });
  });
  it('preserves a verified installer after switching source, even if it is absent in that mirror', async () => {
    const test = setup({ installer: true, automaticEnabled: false });
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    test.showUpdate.mock.calls[0][1].later();
    await test.controller.downloadRelease();
    test.showReady.mock.calls[0][2]();
    expect(test.controller.setSource('cnb')).toBe(true);
    test.fetchUpdate.mockResolvedValue(null);
    await test.controller.checkManually();
    expect(test.controller.getSnapshot()).toMatchObject({
      source: 'cnb',
      release: update,
      downloadStatus: 'ready',
      status: 'available',
    });
    test.showMessage.mock.calls.at(-1)?.[2]();
    await test.controller.installRelease();
    expect(test.installerAPI.install).toHaveBeenCalledWith('file:///update.apk');
    expect(test.installerAPI.start).toHaveBeenCalledTimes(1);
  });
  it('keeps unsupported older native CNB downloads manual while continuing automatic resource updates', async () => {
    const test = setup({
      source: 'cnb',
      installer: true,
      resources: true,
      autoDownloadEnabled: true,
      supportsSource: (source) => source === 'github',
    });
    const mirrored = {
      ...update,
      source: 'cnb' as const,
      url: 'https://cnb.cool/lonzzi/nekofin/-/releases/tag/v0.2.0-beta.2',
    };
    test.fetchUpdate.mockResolvedValue(mirrored);
    test.resourceAPI.check.mockResolvedValue(true);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.installerAPI.start).not.toHaveBeenCalled();
    expect(test.openURL).not.toHaveBeenCalled();
    expect(test.resourceAPI.download).toHaveBeenCalledWith('cnb');
    test.showUpdate.mock.calls[0][1].open();
    await settle();
    expect(test.openURL).toHaveBeenCalledWith(mirrored.url);
  });
});

describe('automatic and manual update coordination', () => {
  it('checks once per day across foreground transitions and retries after later', async () => {
    const test = setup();
    test.controller.setCanPrompt(true);
    await settle();
    test.showUpdate.mock.calls[0][1].later();
    test.controller.setCanPrompt(false);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);

    test.advance(UPDATE_CHECK_INTERVAL_MS);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.fetchUpdate).toHaveBeenCalledTimes(2);
    expect(test.showUpdate).toHaveBeenCalledTimes(2);
  });

  it('defers an in-flight result when playback starts or the app goes to background', async () => {
    const test = setup();
    let finish!: (release: AppRelease) => void;
    test.fetchUpdate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    test.controller.setCanPrompt(true);
    await Promise.resolve();
    test.controller.setCanPrompt(false);
    finish(update);
    await settle();
    expect(test.showUpdate).not.toHaveBeenCalled();

    test.controller.setCanPrompt(true);
    expect(test.showUpdate).toHaveBeenCalledTimes(1);
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);
  });

  it('persists ignore, bypasses it manually, and still reminds for the next release', async () => {
    const test = setup();
    test.controller.setCanPrompt(true);
    await settle();
    test.showUpdate.mock.calls[0][1].ignore();
    expect(test.values.get('appUpdate.ignoredVersion')).toBe(update.version);

    test.advance(UPDATE_CHECK_INTERVAL_MS);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.showUpdate).toHaveBeenCalledTimes(1);

    await test.controller.checkManually();
    expect(test.showUpdate).toHaveBeenCalledTimes(2);
    test.showUpdate.mock.calls[1][1].later();

    test.fetchUpdate.mockResolvedValue({ ...update, version: '0.2.0-beta.3' });
    test.advance(UPDATE_CHECK_INTERVAL_MS);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.showUpdate).toHaveBeenCalledTimes(3);
  });

  it('joins automatic/manual requests and upgrades silent failure to manual feedback', async () => {
    const test = setup();
    let fail!: (error: Error) => void;
    test.fetchUpdate.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    test.controller.setCanPrompt(true);
    const first = test.controller.checkManually();
    const second = test.controller.checkManually();
    await Promise.resolve();
    fail(new Error('网络不可用'));
    await Promise.all([first, second]);
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);
    expect(test.showMessage).toHaveBeenCalledWith(
      '检查更新未完成',
      '安装包：网络不可用',
      expect.any(Function),
    );
  });

  it('keeps automatic errors quiet and throttles failed attempts', async () => {
    const test = setup();
    test.fetchUpdate.mockRejectedValue(new Error('offline'));
    test.controller.setCanPrompt(true);
    await settle();
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.showMessage).not.toHaveBeenCalled();
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot().status).toBe('error');
  });

  it('reports no update for manual checks and never fetches automatically in development', async () => {
    const test = setup({ automaticEnabled: false });
    test.fetchUpdate.mockResolvedValue(null);
    test.controller.setCanPrompt(true);
    expect(test.fetchUpdate).not.toHaveBeenCalled();
    await test.controller.checkManually();
    expect(test.showMessage).toHaveBeenCalledWith(
      '未发现更新',
      expect.stringContaining('v0.2.0-beta.1'),
      expect.any(Function),
    );
    expect(test.controller.getSnapshot().status).toBe('current');
  });

  it('opens only the selected release and handles a failed browser handoff', async () => {
    const test = setup();
    test.openURL.mockRejectedValue(new Error('no browser'));
    test.controller.setCanPrompt(true);
    await settle();
    const actions = test.showUpdate.mock.calls[0][1];
    actions.open();
    await settle();
    expect(test.openURL).toHaveBeenCalledWith(update.url);
    expect(test.showMessage).toHaveBeenCalledWith(
      '无法打开更新页面',
      expect.any(String),
      expect.any(Function),
    );
    // A late Android onDismiss from the first alert must not dismiss the error alert.
    actions.later();
    await test.controller.checkManually();
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not guess a current version when native metadata is missing', async () => {
    const test = setup({ currentVersion: null });
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    expect(test.fetchUpdate).not.toHaveBeenCalled();
    expect(test.showMessage).toHaveBeenCalledWith(
      '检查更新未完成',
      expect.stringContaining('当前应用版本'),
      expect.any(Function),
    );
  });

  it('recovers if the device clock moved backwards', async () => {
    const test = setup();
    test.values.set('appUpdate.lastCheckAt.0.2.0-beta.1', 10_000);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers and stops notifying after unsubscribe', async () => {
    const test = setup({ automaticEnabled: false });
    const listener = vi.fn();
    const unsubscribe = test.controller.subscribe(listener);
    await test.controller.checkManually();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await test.controller.checkManually();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('combined package and resource checks', () => {
  it('checks both sources concurrently and joins repeated manual requests', async () => {
    const test = setup({ automaticEnabled: false, resources: true });
    let finishPackage!: (value: AppRelease | null) => void;
    let finishResource!: (value: boolean) => void;
    test.fetchUpdate.mockReturnValue(
      new Promise((resolve) => {
        finishPackage = resolve;
      }),
    );
    test.resourceAPI.check.mockReturnValue(
      new Promise((resolve) => {
        finishResource = resolve;
      }),
    );
    test.controller.setCanPrompt(true);
    const first = test.controller.checkManually();
    const second = test.controller.checkManually();
    await Promise.resolve();
    expect(test.fetchUpdate).toHaveBeenCalledTimes(1);
    expect(test.resourceAPI.check).toHaveBeenCalledTimes(1);
    finishPackage(null);
    finishResource(true);
    await Promise.all([first, second]);
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'available',
      release: null,
      resourceStatus: 'available',
    });
    expect(test.showResourceUpdate).toHaveBeenCalledTimes(1);
    expect(test.resourceAPI.download).not.toHaveBeenCalled();
  });

  it('keeps a package update available when resources cannot be checked', async () => {
    const test = setup({ automaticEnabled: false, resources: true });
    test.resourceAPI.check.mockRejectedValue(new Error('资源服务离线'));
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'available',
      release: update,
      resourceStatus: 'error',
      resourceError: '资源服务离线',
    });
    expect(test.showUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps resource updates usable when GitHub fails or native version metadata is missing', async () => {
    const test = setup({ automaticEnabled: false, resources: true, currentVersion: null });
    test.resourceAPI.check.mockResolvedValue(true);
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    expect(test.fetchUpdate).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'available',
      resourceStatus: 'available',
      error: expect.stringContaining('当前应用版本'),
    });
    test.showResourceUpdate.mock.calls[0][0]();
    await settle();
    expect(test.showReady).toHaveBeenCalledWith(
      'resources',
      expect.any(Function),
      expect.any(Function),
    );
    expect(test.resourceAPI.apply).not.toHaveBeenCalled();
    test.showReady.mock.calls[0][2]();
    await test.controller.downloadResources();
    expect(test.resourceAPI.download).toHaveBeenCalledTimes(1);
    test.showReady.mock.calls[1][1]();
    await settle();
    expect(test.resourceAPI.apply).toHaveBeenCalledTimes(1);
  });

  it('does not report current if only one check succeeds', async () => {
    const test = setup({ automaticEnabled: false, resources: true });
    test.fetchUpdate.mockResolvedValue(null);
    test.resourceAPI.check.mockRejectedValue(new Error('无法连接资源服务'));
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    expect(test.controller.getSnapshot().status).toBe('error');
    expect(test.showMessage).toHaveBeenCalledWith(
      '检查更新未完成',
      '资源：无法连接资源服务',
      expect.any(Function),
    );
  });

  it('retains a downloaded resource update after reload fails and allows retry', async () => {
    const test = setup({ automaticEnabled: false, resources: true });
    test.controller.setCanPrompt(true);
    await test.controller.downloadResources();
    test.resourceAPI.apply.mockRejectedValueOnce(new Error('reload failed'));
    test.showReady.mock.calls[0][1]();
    await settle();
    expect(test.controller.getSnapshot().resourceStatus).toBe('ready');
    test.showMessage.mock.calls[0][2]();
    await test.controller.downloadResources();
    test.showReady.mock.calls[1][1]();
    await settle();
    expect(test.resourceAPI.download).toHaveBeenCalledTimes(1);
    expect(test.resourceAPI.apply).toHaveBeenCalledTimes(2);
  });
});

describe('in-app installer downloads', () => {
  async function checked() {
    const test = setup({ automaticEnabled: false, installer: true });
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    test.showUpdate.mock.calls[0][1].later();
    return test;
  }

  it('restores progress and waits for explicit confirmation outside playback before installing', async () => {
    const test = await checked();
    test.installerAPI.start.mockResolvedValue({
      release: update,
      automatic: false,
      status: 'downloading',
      progress: 45,
    });
    await test.controller.downloadRelease();
    expect(test.controller.getSnapshot()).toMatchObject({
      downloadStatus: 'downloading',
      downloadProgress: 45,
    });
    expect(test.installerAPI.install).not.toHaveBeenCalled();
    expect(test.openURL).not.toHaveBeenCalled();
    test.controller.setCanPrompt(false);
    test.installerAPI.refresh.mockResolvedValue({
      release: update,
      automatic: false,
      status: 'ready',
      progress: 100,
      uri: 'file:///update.apk',
    });
    await test.controller.refreshDownload();
    expect(test.controller.getSnapshot().downloadStatus).toBe('ready');
    expect(test.showReady).not.toHaveBeenCalled();
    test.controller.setCanPrompt(true);
    expect(test.showReady).toHaveBeenCalledTimes(1);
    test.showReady.mock.calls[0][1]();
    await settle();
    expect(test.installerAPI.install).toHaveBeenCalledWith('file:///update.apk');
  });

  it('keeps the downloaded installer after later or permission settings, without downloading again', async () => {
    const test = await checked();
    await test.controller.downloadRelease();
    test.showReady.mock.calls[0][2]();
    test.installerAPI.install.mockResolvedValueOnce('permission-required');
    await test.controller.installRelease();
    expect(test.controller.getSnapshot().downloadStatus).toBe('ready');
    test.showMessage.mock.calls[0][2]();
    await test.controller.installRelease();
    expect(test.installerAPI.start).toHaveBeenCalledTimes(1);
    expect(test.installerAPI.install).toHaveBeenCalledTimes(2);
  });

  it('keeps an already downloaded installer usable after a failed offline refresh', async () => {
    const test = await checked();
    await test.controller.downloadRelease();
    test.showReady.mock.calls[0][2]();
    test.fetchUpdate.mockRejectedValue(new Error('offline'));
    await test.controller.checkManually();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      release: update,
      downloadStatus: 'ready',
    });
    test.showMessage.mock.calls[0][2]();
    await test.controller.installRelease();
    expect(test.installerAPI.install).toHaveBeenCalledWith('file:///update.apk');
    expect(test.installerAPI.start).toHaveBeenCalledTimes(1);
  });

  it('does not offer installation after a failed or unverified download', async () => {
    const test = await checked();
    test.installerAPI.start.mockRejectedValueOnce(new Error('checksum mismatch'));
    await test.controller.downloadRelease();
    expect(test.controller.getSnapshot().downloadStatus).toBe('error');
    expect(test.showReady).not.toHaveBeenCalled();
    expect(test.installerAPI.install).not.toHaveBeenCalled();
    test.showMessage.mock.calls[0][2]();
    await test.controller.downloadRelease();
    expect(test.controller.getSnapshot().downloadStatus).toBe('ready');
  });

  it('cancels the system transfer quietly and permits manual retry', async () => {
    const test = await checked();
    test.installerAPI.start.mockResolvedValueOnce({
      release: update,
      automatic: false,
      status: 'downloading',
      progress: 5,
    });
    await test.controller.downloadRelease();
    await test.controller.cancelDownload();
    expect(test.installerAPI.cancel).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot().downloadStatus).toBe('idle');
    expect(test.showMessage).not.toHaveBeenCalled();
    expect(test.showReady).not.toHaveBeenCalled();
    await test.controller.downloadRelease();
    expect(test.controller.getSnapshot().downloadStatus).toBe('ready');
  });
});

describe('automatic system download policy', () => {
  it('downloads silently and only prompts after verification completes', async () => {
    const test = setup({ installer: true, autoDownloadEnabled: true });
    test.installerAPI.start.mockResolvedValue({
      release: update,
      automatic: true,
      status: 'downloading',
      progress: 0,
      waiting: '等待非计费网络',
    });
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.installerAPI.start).toHaveBeenCalledWith(update, true);
    expect(test.showUpdate).not.toHaveBeenCalled();
    expect(test.showReady).not.toHaveBeenCalled();
    test.installerAPI.refresh.mockResolvedValue({
      release: update,
      automatic: true,
      status: 'ready',
      progress: 100,
      uri: 'file:///update.apk',
    });
    await test.controller.refreshDownload();
    expect(test.showReady).toHaveBeenCalledTimes(1);
    expect(test.installerAPI.install).not.toHaveBeenCalled();
    test.showReady.mock.calls[0][2]();
    await test.controller.refreshDownload();
    expect(test.showReady).toHaveBeenCalledTimes(1);
  });

  it('does not start an automatic download if playback starts while a check is running', async () => {
    const test = setup({ installer: true, autoDownloadEnabled: true });
    let finish!: (release: AppRelease) => void;
    test.fetchUpdate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    test.controller.setCanPrompt(true);
    await Promise.resolve();
    test.controller.setCanPrompt(false);
    finish(update);
    await settle();
    expect(test.installerAPI.start).not.toHaveBeenCalled();
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.installerAPI.start).toHaveBeenCalledTimes(1);
  });

  it('honors disabling auto download without cancelling manual transfers', async () => {
    const test = setup({ installer: true, autoDownloadEnabled: true });
    test.installerAPI.start.mockResolvedValue({
      release: update,
      automatic: true,
      status: 'downloading',
      progress: 5,
    });
    test.controller.setCanPrompt(true);
    await settle();
    test.controller.setAutoDownloadEnabled(false);
    await settle();
    expect(test.installerAPI.cancel).toHaveBeenCalledTimes(1);
    test.installerAPI.start.mockResolvedValue({
      release: update,
      automatic: false,
      status: 'downloading',
      progress: 5,
    });
    await test.controller.downloadRelease();
    test.controller.setAutoDownloadEnabled(false);
    await settle();
    expect(test.installerAPI.cancel).toHaveBeenCalledTimes(1);
  });

  it('restores a completed download without a network check or a new download', async () => {
    const test = setup({ installer: true, automaticEnabled: false, autoDownloadEnabled: true });
    test.installerAPI.refresh.mockResolvedValue({
      release: update,
      automatic: true,
      status: 'ready',
      progress: 100,
      uri: 'file:///update.apk',
    });
    await test.controller.refreshDownload();
    expect(test.showReady).not.toHaveBeenCalled();
    test.controller.setCanPrompt(true);
    expect(test.showReady).toHaveBeenCalledTimes(1);
    expect(test.installerAPI.start).not.toHaveBeenCalled();
    expect(test.fetchUpdate).not.toHaveBeenCalled();
  });

  it('does not offer a restored installer older than the installed release', async () => {
    const test = setup({ installer: true, currentVersion: '0.2.0-beta.3' });
    test.installerAPI.refresh.mockResolvedValue({
      release: update,
      automatic: true,
      status: 'ready',
      progress: 100,
      uri: 'file:///update.apk',
    });
    await test.controller.refreshDownload();
    expect(test.controller.getSnapshot().release).toBeNull();
    expect(test.installerAPI.cancel).toHaveBeenCalledTimes(1);
    expect(test.showReady).not.toHaveBeenCalled();
  });

  it('downloads resources silently when no Android installer update takes priority', async () => {
    const test = setup({ resources: true, autoDownloadEnabled: true });
    test.fetchUpdate.mockResolvedValue(null);
    test.resourceAPI.check.mockResolvedValue(true);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.resourceAPI.download).toHaveBeenCalledTimes(1);
    expect(test.showResourceUpdate).not.toHaveBeenCalled();
    expect(test.resourceAPI.apply).not.toHaveBeenCalled();
    expect(test.showReady).toHaveBeenCalledWith(
      'resources',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('waits for an allowed network before automatically downloading resources', async () => {
    const test = setup({ resources: true, autoDownloadEnabled: true });
    test.fetchUpdate.mockResolvedValue(null);
    test.resourceAPI.check.mockResolvedValue(true);
    test.canAutoDownloadResources.mockResolvedValue(false);
    test.controller.setCanPrompt(true);
    await settle();
    expect(test.resourceAPI.download).not.toHaveBeenCalled();
    test.canAutoDownloadResources.mockResolvedValue(true);
    await test.controller.refreshDownload();
    await settle();
    expect(test.resourceAPI.download).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a cancelled download when the enqueue callback arrives late', async () => {
    const test = setup({ installer: true, automaticEnabled: false });
    test.controller.setCanPrompt(true);
    await test.controller.checkManually();
    test.showUpdate.mock.calls[0][1].later();
    let finish!: (download: InstallerDownload) => void;
    test.installerAPI.start.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const start = test.controller.downloadRelease();
    await Promise.resolve();
    const cancel = test.controller.cancelDownload();
    finish({
      release: update,
      automatic: false,
      status: 'ready',
      progress: 100,
      uri: 'file:///update.apk',
    });
    await Promise.all([start, cancel]);
    expect(test.controller.getSnapshot().downloadStatus).toBe('idle');
    expect(test.showReady).not.toHaveBeenCalled();
  });
});
