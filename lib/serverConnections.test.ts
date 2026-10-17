import type { MediaServerInfo } from '@/services/media/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  connectToMediaServer,
  getConnectionPolicy,
  getPublicServerIdentity,
  getPublicServerInfo,
  getServerConnections,
  hasSameServerSession,
  resolveAutomaticConnection,
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
  it('accepts Emby deployments that expose their API only under /emby', async () => {
    const readInfo = vi
      .fn()
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({ id: 'emby-1', name: 'Emby', version: '4.9' });
    await expect(
      connectToMediaServer('https://media.test', 'emby', readInfo),
    ).resolves.toMatchObject({ id: 'emby-1', address: 'https://media.test/emby' });
    expect(readInfo.mock.calls).toEqual([['https://media.test'], ['https://media.test/emby']]);
  });

  it('keeps explicit base paths and does not invent Emby routes for Jellyfin', async () => {
    const readInfo = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      connectToMediaServer('https://media.test/jellyfin', 'jellyfin', readInfo),
    ).rejects.toThrow('offline');
    expect(readInfo).toHaveBeenCalledExactlyOnceWith('https://media.test/jellyfin');
  });
  it('reads server details for the connection step without requesting an account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Id: 'nas-1', ServerName: 'Home NAS', Version: '10.11' })),
    );
    await expect(getPublicServerInfo('https://media.test')).resolves.toEqual({
      id: 'nas-1',
      name: 'Home NAS',
      version: '10.11',
    });
  });
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

describe('automatic server connections', () => {
  const configured: MediaServerInfo = {
    ...server,
    remoteServerId: 'NAS-1',
    connections: [
      { id: 'remote', name: '外网', address: 'https://wan.test' },
      { id: 'local', name: '局域网', address: server.address },
    ],
    connectionPolicy: { enabled: true, defaultConnectionId: 'remote', localConnectionId: 'local' },
  };

  it('uses a reachable and verified LAN on Wi-Fi', async () => {
    const verify = vi.fn().mockResolvedValue({});
    await expect(
      resolveAutomaticConnection(configured, { connected: true, wifi: true }, verify),
    ).resolves.toBe('local');
    expect(verify).toHaveBeenCalledExactlyOnceWith(configured, server.address);
  });

  it('returns to the default when leaving Wi-Fi, without probing the LAN', async () => {
    const verify = vi.fn();
    await expect(
      resolveAutomaticConnection(configured, { connected: true, wifi: false }, verify),
    ).resolves.toBe('remote');
    expect(verify).not.toHaveBeenCalled();
  });

  it('falls back when the LAN is offline or belongs to a different server', async () => {
    for (const message of ['offline', 'another server', 'account expired']) {
      const verify = vi.fn().mockRejectedValue(new Error(message));
      await expect(
        resolveAutomaticConnection(configured, { connected: true, wifi: true }, verify),
      ).resolves.toBe('remote');
    }
    expect(configured.address).toBe(server.address);
  });

  it('does not probe or change a connection while offline or disabled', async () => {
    const verify = vi.fn();
    await expect(
      resolveAutomaticConnection(configured, { connected: false, wifi: true }, verify),
    ).resolves.toBeNull();
    await expect(
      resolveAutomaticConnection(
        { ...configured, connectionPolicy: { ...configured.connectionPolicy!, enabled: false } },
        { connected: true, wifi: true },
        verify,
      ),
    ).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it('disables stale configurations after deleting the local line or choosing the same line twice', () => {
    expect(
      getConnectionPolicy({
        ...configured,
        connections: [configured.connections![0]],
        address: 'https://wan.test',
      }).enabled,
    ).toBe(false);
    expect(
      getConnectionPolicy({
        ...configured,
        connectionPolicy: {
          enabled: true,
          defaultConnectionId: 'remote',
          localConnectionId: 'remote',
        },
      }).enabled,
    ).toBe(false);
    expect(getConnectionPolicy(server)).toEqual({
      enabled: false,
      defaultConnectionId: 'default',
      localConnectionId: undefined,
    });
  });
});
