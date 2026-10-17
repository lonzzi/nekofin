import { describe, expect, it, vi } from 'vitest';

import { downloadHotUpdate } from './hotUpdates';

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
