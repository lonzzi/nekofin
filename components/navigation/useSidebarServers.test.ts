import type { MediaServerInfo } from '@/services/media/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSidebarServers } from './useSidebarServers';

const mocks = vi.hoisted(() => ({
  servers: [] as MediaServerInfo[],
  activeServers: [] as MediaServerInfo[],
  homeServerId: null as string | null,
  setHomeServer: vi.fn(),
  getToolbarAvatar: vi.fn(async (source: string) => `cached:${source}`),
}));
vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useState: (factory: () => unknown) => [factory(), vi.fn()],
  useEffect: (effect: () => unknown) => effect(),
}));
vi.mock('@/lib/contexts/MediaServerContext', () => ({ useMediaServers: () => mocks }));
vi.mock('@/modules/toolbar-avatar', () => ({
  getCachedToolbarAvatar: () => undefined,
  getToolbarAvatar: mocks.getToolbarAvatar,
}));

const first: MediaServerInfo = {
  id: 'first',
  type: 'jellyfin',
  remoteServerId: 'nas',
  address: 'https://nas.test',
  name: 'NAS',
  userId: 'user-1',
  username: 'one',
  accessToken: 'test-token-1',
  userAvatar: 'https://nas.test/avatar-one',
  createdAt: 1,
};
const second = {
  ...first,
  id: 'second',
  userId: 'user-2',
  userAvatar: 'https://nas.test/avatar-two',
  accessToken: 'test-token-2',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.servers = [first, second];
  mocks.activeServers = [second];
  mocks.homeServerId = second.id;
});

describe('tablet sidebar active accounts', () => {
  it('lists and fetches avatars only for active accounts without exposing credentials', () => {
    const sidebar = useSidebarServers();
    expect(sidebar.items).toEqual([
      { id: second.id, name: second.name, type: second.type, avatarUri: '' },
    ]);
    expect(sidebar.homeServerId).toBe(second.id);
    expect(mocks.getToolbarAvatar).toHaveBeenCalledExactlyOnceWith(second.userAvatar);
    expect(sidebar.selectServer(first.id)).toBe(false);
    expect(mocks.setHomeServer).not.toHaveBeenCalled();
    expect(sidebar.selectServer(second.id)).toBe(true);
    expect(mocks.setHomeServer).toHaveBeenCalledExactlyOnceWith(second);
  });

  it('reflects account switches and keeps other physical servers visible', () => {
    const other = { ...first, id: 'other', remoteServerId: 'other-nas' };
    mocks.servers.push(other);
    mocks.activeServers = [first, other];
    mocks.homeServerId = first.id;
    const sidebar = useSidebarServers();
    expect(sidebar.items.map((item) => item.id)).toEqual([first.id, other.id]);
    expect(sidebar.selectServer(second.id)).toBe(false);
    expect(sidebar.selectServer(other.id)).toBe(true);
    expect(mocks.setHomeServer).toHaveBeenCalledExactlyOnceWith(other);
  });
});
