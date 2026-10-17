import { describe, expect, it, vi } from 'vitest';

import {
  createAppUpdateController,
  UPDATE_CHECK_INTERVAL_MS,
  type UpdatePromptActions,
} from './appUpdateController';
import type { AppRelease } from './appUpdates';

const update: AppRelease = {
  version: '0.2.0-beta.2',
  tag: 'v0.2.0-beta.2',
  url: 'https://github.com/lonzzi/nekofin/releases/tag/v0.2.0-beta.2',
};

function setup({ automaticEnabled = true, currentVersion = '0.2.0-beta.1' as string | null } = {}) {
  let time = 1_000;
  const values = new Map<string, number | string>();
  const fetchUpdate = vi.fn<() => Promise<AppRelease | null>>().mockResolvedValue(update);
  const showUpdate = vi.fn<(release: AppRelease, actions: UpdatePromptActions) => void>();
  const showMessage = vi.fn<(title: string, message: string, dismiss: () => void) => void>();
  const openURL = vi.fn().mockResolvedValue(undefined);
  const controller = createAppUpdateController({
    currentVersion,
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
    now: () => time,
  });
  return {
    controller,
    values,
    fetchUpdate,
    showUpdate,
    showMessage,
    openURL,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
  };
}

const settle = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

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
      '检查更新失败',
      '网络不可用',
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
      '检查更新失败',
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
