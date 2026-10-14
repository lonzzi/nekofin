import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android' },
  prefetch: vi.fn(),
  getCachePathAsync: vi.fn(),
  loadAsync: vi.fn(),
  createCircularImage: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('expo-image', () => ({
  Image: {
    prefetch: mocks.prefetch,
    getCachePathAsync: mocks.getCachePathAsync,
    loadAsync: mocks.loadAsync,
  },
}));
vi.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({ createCircularImage: mocks.createCircularImage }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.platform.OS = 'android';
  mocks.prefetch.mockResolvedValue(true);
  mocks.getCachePathAsync.mockResolvedValue('/cache/avatar.png');
  mocks.loadAsync.mockResolvedValue({ width: 108, height: 108 });
});

describe('toolbar avatar loading', () => {
  const source = 'https://example.com/avatar.png';

  it('only exposes an Android avatar after its local file has decoded', async () => {
    const { getToolbarAvatar, getCachedToolbarAvatar } = await import('./index');
    const loading = getToolbarAvatar(source);
    expect(getCachedToolbarAvatar(source)).toBeUndefined();
    await expect(loading).resolves.toBe('file:///cache/avatar.png');
    expect(mocks.loadAsync).toHaveBeenCalledWith('file:///cache/avatar.png', {
      maxWidth: 108,
      maxHeight: 108,
    });
    expect(getCachedToolbarAvatar(source)).toBe('file:///cache/avatar.png');
  });

  it('keeps failed requests out of the ready cache and permits a retry', async () => {
    mocks.prefetch.mockResolvedValueOnce(false);
    const { getToolbarAvatar, getCachedToolbarAvatar } = await import('./index');
    await expect(getToolbarAvatar(source)).rejects.toThrow();
    expect(getCachedToolbarAvatar(source)).toBeUndefined();
    expect(mocks.loadAsync).not.toHaveBeenCalled();
    await expect(getToolbarAvatar(source)).resolves.toBe('file:///cache/avatar.png');
    expect(mocks.prefetch).toHaveBeenCalledTimes(2);
  });

  it('rejects missing disk files and undecodable images instead of showing a blank icon', async () => {
    const { getToolbarAvatar, getCachedToolbarAvatar } = await import('./index');
    mocks.getCachePathAsync.mockResolvedValueOnce(null);
    await expect(getToolbarAvatar(source)).rejects.toThrow();
    mocks.loadAsync.mockRejectedValueOnce(new Error('decode failed'));
    await expect(getToolbarAvatar(source)).rejects.toThrow('decode failed');
    expect(getCachedToolbarAvatar(source)).toBeUndefined();
  });

  it('coalesces Android loads for the same source', async () => {
    const { getToolbarAvatar } = await import('./index');
    const first = getToolbarAvatar(source);
    const second = getToolbarAvatar(source);
    expect(first).toBe(second);
    await first;
    expect(mocks.prefetch).toHaveBeenCalledTimes(1);
  });

  it('retains the existing iOS native circular avatar pipeline', async () => {
    mocks.platform.OS = 'ios';
    mocks.createCircularImage.mockResolvedValue('file:///ios/circular-avatar.png');
    const { getToolbarAvatar } = await import('./index');
    await expect(getToolbarAvatar(source)).resolves.toBe('file:///ios/circular-avatar.png');
    expect(mocks.loadAsync).toHaveBeenCalledWith(source, { maxWidth: 108, maxHeight: 108 });
    expect(mocks.createCircularImage).toHaveBeenCalledWith({ width: 108, height: 108 });
    expect(mocks.prefetch).not.toHaveBeenCalled();
  });
});
