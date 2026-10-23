import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from './toast.android';

const native = vi.hoisted(() => ({ toast: vi.fn(), alert: vi.fn() }));
vi.mock('react-native', () => ({
  ToastAndroid: { show: native.toast, SHORT: 0, LONG: 1 },
  Alert: { alert: native.alert },
}));

beforeEach(() => vi.clearAllMocks());

describe('Android native feedback', () => {
  it('uses system duration constants for brief feedback', () => {
    toast.success('Saved');
    toast.error('Connection failed');
    toast.info('Updated');
    expect(native.toast.mock.calls).toEqual([
      ['Saved', 0],
      ['Connection failed', 1],
      ['Updated', 0],
    ]);
    expect(native.alert).not.toHaveBeenCalled();
  });

  it('preserves structured error details in a native alert', () => {
    const description = 'The server identity changed. '.repeat(8);
    toast.error('Connection failed', { description });
    expect(native.alert).toHaveBeenCalledWith('Connection failed', description);
    expect(native.toast).not.toHaveBeenCalled();
  });

  it('keeps errors without detail in system Toasts', () => {
    toast.error('Connection failed', { description: '' });
    expect(native.toast).toHaveBeenCalledWith('Connection failed', 1);
    expect(native.alert).not.toHaveBeenCalled();
  });
});
