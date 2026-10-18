import type { MediaServerInfo } from '@/services/media/types';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaServerProvider, useMediaServers } from './MediaServerContext';

const mocks = vi.hoisted(() => ({
  values: new Map<string, string>(),
  effects: [] as (() => void)[],
  readUser: vi.fn(),
  createApi: vi.fn((server: { address: string }) => ({ basePath: server.address })),
  queryClient: { cancelQueries: vi.fn(), removeQueries: vi.fn() },
}));

// Exercise the provider's commands and storage without mounting native UI.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => void) => mocks.effects.push(effect),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock('@/hooks/useAutomaticServerConnections', () => ({
  useAutomaticServerConnections: vi.fn(),
}));
vi.mock('@/services/media', () => ({
  createMediaApiFromServerInfo: mocks.createApi,
  createMediaAdapterWithApi: () => ({ getUserInfo: mocks.readUser }),
  getMediaAdapter: vi.fn(),
}));
vi.mock('@/services/media/jellyfin', () => ({ deleteCachedApiForServer: vi.fn() }));
vi.mock('@/lib/storage', () => ({
  storage: {
    getString: (key: string) => mocks.values.get(key),
    set: (key: string, value: string) => mocks.values.set(key, value),
  },
}));

const legacy: MediaServerInfo = {
  id: 'legacy-account',
  type: 'jellyfin',
  address: 'http://legacy.test:8097',
  name: 'My NAS',
  note: 'Keep my settings',
  userId: 'user-1',
  username: 'one',
  accessToken: 'test-token',
  userAvatar: '',
  createdAt: 123,
  connectionPolicy: { enabled: false, defaultConnectionId: 'default' },
};
const nextAddress = 'https://media.test/jellyfin';

function loadContext(server: MediaServerInfo = legacy) {
  mocks.values.set('nekofin_servers', JSON.stringify([server]));
  const provider = MediaServerProvider({ children: null }) as ReactElement<{
    value: ReturnType<typeof useMediaServers>;
  }>;
  for (const effect of mocks.effects.splice(0)) effect();
  return provider.props.value;
}

function savedServer(): MediaServerInfo {
  return JSON.parse(mocks.values.get('nekofin_servers')!)[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.values.clear();
  mocks.effects.length = 0;
  mocks.readUser.mockResolvedValue({ id: legacy.userId, avatar: '' });
  mocks.queryClient.cancelQueries.mockResolvedValue(undefined);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ Id: 'nas-1' }));
});
afterEach(() => vi.restoreAllMocks());

describe('verified legacy connection edits', () => {
  it.each([false, true])(
    'replaces the sole active route with explicit connections=%s',
    async (explicit) => {
      const context = loadContext({
        ...legacy,
        connections: explicit
          ? [{ id: 'default', name: 'Old route', address: legacy.address }]
          : undefined,
      });
      await context.saveConnection(legacy.id, 'New route', nextAddress, 'default');

      expect(savedServer()).toMatchObject({
        ...legacy,
        address: nextAddress,
        remoteServerId: 'nas-1',
        connections: [{ id: 'default', name: 'New route', address: nextAddress }],
      });
      expect(savedServer().connections).toHaveLength(1);
      expect(mocks.readUser).toHaveBeenCalledExactlyOnceWith({ userId: legacy.userId });
      expect(mocks.createApi).toHaveBeenCalledWith(
        expect.objectContaining({ address: nextAddress }),
        false,
      );
    },
  );

  it('rejects another server before forwarding account credentials', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ Id: 'nas-1' }))
      .mockResolvedValueOnce(Response.json({ Id: 'nas-2' }));
    const context = loadContext();
    await expect(
      context.saveConnection(legacy.id, 'New route', nextAddress, 'default'),
    ).rejects.toThrow('另一台服务器');
    expect(mocks.createApi).not.toHaveBeenCalled();
    expect(mocks.readUser).not.toHaveBeenCalled();
    expect(savedServer()).toEqual(legacy);
  });

  it('keeps the legacy record unchanged when account verification fails', async () => {
    mocks.readUser.mockResolvedValueOnce({ id: 'another-user' });
    const context = loadContext();
    await expect(
      context.saveConnection(legacy.id, 'New route', nextAddress, 'default'),
    ).rejects.toThrow('验证当前账号');
    expect(savedServer()).toEqual(legacy);
  });

  it('discards verification when the account session changes during the request', async () => {
    const context = loadContext();
    mocks.readUser.mockImplementationOnce(async () => {
      await context.updateServer(legacy.id, { accessToken: 'refreshed-token' });
      return { id: legacy.userId };
    });
    await expect(
      context.saveConnection(legacy.id, 'New route', nextAddress, 'default'),
    ).rejects.toThrow('连接已更新');
    expect(savedServer()).toMatchObject({ ...legacy, accessToken: 'refreshed-token' });
    expect(savedServer().remoteServerId).toBeUndefined();
  });
});
