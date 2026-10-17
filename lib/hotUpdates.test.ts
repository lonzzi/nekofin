import { describe, expect, it, vi } from 'vitest';

import { applyHotUpdate, downloadHotUpdate } from './hotUpdates';

describe('hot update downloads', () => {
  it('downloads an available update without reloading the running app', async () => {
    const fetch = vi.fn().mockResolvedValue({ isNew: true });
    expect(await downloadHotUpdate({ check: async () => ({ isAvailable: true }), fetch })).toBe(
      'pending',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not download when already current', async () => {
    const fetch = vi.fn();
    expect(await downloadHotUpdate({ check: async () => ({ isAvailable: false }), fetch })).toBe(
      'current',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('prepares rollback directives through the same native download API', async () => {
    expect(
      await downloadHotUpdate({
        check: async () => ({ isAvailable: false, isRollBackToEmbedded: true }),
        fetch: async () => ({ isNew: false, isRollBackToEmbedded: true }),
      }),
    ).toBe('pending');
  });
  it('leaves failures to the caller and never reports a failed download as pending', async () => {
    await expect(
      downloadHotUpdate({
        check: async () => ({ isAvailable: true }),
        fetch: async () => {
          throw new Error('signature failed');
        },
      }),
    ).rejects.toThrow('signature failed');
  });
});

describe('manually applying hot updates', () => {
  function setup() {
    return {
      api: {
        check: vi.fn().mockResolvedValue({ isAvailable: true }),
        fetch: vi.fn().mockResolvedValue({ isNew: true }),
        reload: vi.fn().mockResolvedValue(undefined),
      },
      options: { isUpdatePending: false, onApplying: vi.fn() },
    };
  }

  it('waits for the entire download before reloading', async () => {
    const { api, options } = setup();
    let finishDownload!: (value: { isNew: boolean }) => void;
    api.fetch.mockImplementation(() => new Promise((resolve) => (finishDownload = resolve)));
    const result = applyHotUpdate(api, options);
    await vi.waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
    expect(api.reload).not.toHaveBeenCalled();
    expect(options.onApplying).not.toHaveBeenCalled();
    finishDownload({ isNew: true });
    await expect(result).resolves.toBe('applied');
    expect(options.onApplying).toHaveBeenCalledOnce();
    expect(api.reload).toHaveBeenCalledOnce();
  });

  it('applies an already downloaded update without requiring a network connection', async () => {
    const { api, options } = setup();
    options.isUpdatePending = true;
    await expect(applyHotUpdate(api, options)).resolves.toBe('applied');
    expect(api.check).not.toHaveBeenCalled();
    expect(api.fetch).not.toHaveBeenCalled();
    expect(api.reload).toHaveBeenCalledOnce();
  });

  it('keeps the current session when no update is available', async () => {
    const { api, options } = setup();
    api.check.mockResolvedValue({ isAvailable: false });
    await expect(applyHotUpdate(api, options)).resolves.toBe('current');
    expect(api.fetch).not.toHaveBeenCalled();
    expect(api.reload).not.toHaveBeenCalled();
  });

  it('applies a signed rollback through the same user action', async () => {
    const { api, options } = setup();
    api.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true });
    api.fetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: true });
    await expect(applyHotUpdate(api, options)).resolves.toBe('applied');
    expect(api.reload).toHaveBeenCalledOnce();
  });

  it('does not interrupt the app if checking or verifying the download fails', async () => {
    for (const stage of ['check', 'fetch'] as const) {
      const { api, options } = setup();
      api[stage].mockRejectedValue(new Error('Update rejected'));
      await expect(applyHotUpdate(api, options)).rejects.toThrow('Update rejected');
      expect(api.reload).not.toHaveBeenCalled();
    }
  });

  it('does not reload if the server stops offering the update during download', async () => {
    const { api, options } = setup();
    api.fetch.mockResolvedValue({ isNew: false });
    await expect(applyHotUpdate(api, options)).resolves.toBe('current');
    expect(api.reload).not.toHaveBeenCalled();
  });

  it('surfaces reload failures so the user can retry', async () => {
    const { api, options } = setup();
    api.reload.mockRejectedValue(new Error('Reload failed'));
    await expect(applyHotUpdate(api, options)).rejects.toThrow('Reload failed');
  });
});
