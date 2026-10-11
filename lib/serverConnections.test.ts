import type { MediaServerInfo } from '@/services/media/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getPublicServerIdentity,
  getServerConnections,
  hasSameServerSession,
  selectServerConnection,
  verifyServerConnection,
} from './serverConnections';

afterEach(() => vi.restoreAllMocks());

const server: MediaServerInfo = {
  id: 'account',
  address: 'http://lan:8097',
  name: 'NAS',
  type: 'jellyfin',
  userId: 'user',
  username: 'User',
  userAvatar: 'http://lan:8097/Users/user/Images/Primary',
  accessToken: 'test-token',
  createdAt: 100,
};

describe('server connections', () => {
  it('rejects stale request results after removal, a line switch, or reauthentication', () => {
    expect(hasSameServerSession(server, undefined)).toBe(false);
    for (const updates of [
      { address: 'https://wan.test' },
      { userId: 'another-user' },
      { accessToken: 'refreshed-token' },
      { type: 'emby' as const },
    ]) {
      expect(hasSameServerSession(server, { ...server, ...updates })).toBe(false);
    }
    const renamed = { ...server, name: 'Renamed NAS', userAvatar: '' };
    expect(hasSameServerSession(server, renamed)).toBe(true);
  });
  it('probes the public identity without authorization headers and preserves reverse proxy paths', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ Id: 'NAS-1' })));
    await expect(getPublicServerIdentity('https://media.test/jellyfin/')).resolves.toBe('NAS-1');
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'https://media.test/jellyfin/System/Info/Public',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('reports an unusable endpoint before attempting account verification', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(getPublicServerIdentity('http://nas:80')).rejects.toThrow('检查线路地址');
  });

  it('keeps connection ids unique after editing or reauthenticating an address', () => {
    const lines = getServerConnections({
      ...server,
      address: 'https://new.test',
      connections: getServerConnections(server),
    });
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
    expect(lines.map((line) => line.address)).toContain('https://new.test');
  });
  it('migrates a saved account and keeps its id, token, and account settings on switching', () => {
    const connections = [
      ...getServerConnections(server),
      { id: 'wan', name: '外网', address: 'https://media.test/jellyfin' },
    ];
    const switched = selectServerConnection({ ...server, connections }, 'wan');
    expect(switched).toMatchObject({
      id: server.id,
      userId: server.userId,
      accessToken: server.accessToken,
      createdAt: 100,
      address: 'https://media.test/jellyfin',
    });
    expect(switched.userAvatar).toBe(
      'https://media.test/jellyfin/Users/user/Images/Primary?quality=90',
    );
    expect(getServerConnections(switched)).toHaveLength(2);
    expect(selectServerConnection(switched, 'default').address).toBe(server.address);
  });

  it('does not send credentials when validating a different endpoint', async () => {
    const readIdentity = vi.fn().mockResolvedValueOnce('NAS-1').mockResolvedValueOnce('NAS-2');
    await expect(
      verifyServerConnection(server, 'https://other.test', readIdentity),
    ).rejects.toThrow('另一台服务器');
    expect(readIdentity.mock.calls).toEqual([[server.address], ['https://other.test']]);
    expect(server.address).toBe('http://lan:8097');
  });

  it('can switch away from an offline LAN after saving the server identity', async () => {
    const readIdentity = vi.fn().mockResolvedValue('NAS-1');
    await expect(
      verifyServerConnection(
        { ...server, remoteServerId: 'NAS-1' },
        'https://wan.test',
        readIdentity,
      ),
    ).resolves.toBe('NAS-1');
    expect(readIdentity).toHaveBeenCalledExactlyOnceWith('https://wan.test');
  });

  it('leaves the current connection untouched if the destination is unreachable', async () => {
    const readIdentity = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      verifyServerConnection(
        { ...server, remoteServerId: 'NAS-1' },
        'https://offline.test',
        readIdentity,
      ),
    ).rejects.toThrow('offline');
    expect(getServerConnections(server)[0].address).toBe(server.address);
  });
});
