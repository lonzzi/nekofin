import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toast as iosToast } from './toast';

const native = vi.hoisted(() => ({ burnt: vi.fn() }));
vi.mock('burnt', () => ({ toast: native.burnt }));

beforeEach(() => vi.clearAllMocks());

describe('iOS native feedback', () => {
  it('delegates iOS presentation and message details to Burnt', () => {
    iosToast.success('Saved');
    iosToast.error('Connection failed', { description: 'Check the server URL' });
    iosToast.info('Updated');
    expect(native.burnt.mock.calls.map(([options]) => options)).toEqual([
      {
        title: 'Saved',
        message: undefined,
        preset: 'done',
        haptic: 'none',
        duration: 3,
        from: 'top',
      },
      {
        title: 'Connection failed',
        message: 'Check the server URL',
        preset: 'error',
        haptic: 'none',
        duration: 5,
        from: 'top',
      },
      {
        title: 'Updated',
        message: undefined,
        preset: 'none',
        haptic: 'none',
        duration: 3,
        from: 'top',
      },
    ]);
  });
});
