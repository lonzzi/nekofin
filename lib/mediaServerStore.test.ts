import type { MediaServerInfo } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  createMediaServerStorageId,
  normalizeServerAddress,
  prepareAuthenticatedServer,
  upsertMediaServer,
} from './mediaServerStore';

const baseServer: MediaServerInfo = {
  id: 'https://media.test_user-1',
  address: 'https://media.test',
  name: 'Media',
  userId: 'user-1',
  username: 'User One',
  userAvatar: '',
  accessToken: 'token-1',
  createdAt: 100,
  type: 'jellyfin',
};

describe('media server store helpers', () => {
  it('merges a login through another address into the same remote account and preserves settings', () => {
    const existing = {
      ...baseServer,
      remoteServerId: 'nas-1',
      name: 'My NAS',
      note: 'my notes',
      connectionPolicy: { enabled: false, defaultConnectionId: 'default' },
      connections: [{ id: 'default', name: '外网', address: baseServer.address }],
    };
    const incoming = prepareAuthenticatedServer([existing], {
      ...baseServer,
      address: 'http://192.168.1.2:8096',
      remoteServerId: 'nas-1',
      accessToken: 'new-token',
    });
    const saved = upsertMediaServer([existing], incoming, 200);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: existing.id,
      name: 'My NAS',
      createdAt: 100,
      note: 'my notes',
      accessToken: 'new-token',
      connectionPolicy: existing.connectionPolicy,
    });
    expect(saved[0].connections?.map((line) => line.address)).toEqual([
      existing.address,
      'http://192.168.1.2:8096',
    ]);
    expect(existing.connections).toHaveLength(1);
    expect(prepareAuthenticatedServer(saved, { ...incoming }).connections).toHaveLength(2);
  });

  it('keeps different users, server types, and remote server identities separate', () => {
    const existing = { ...baseServer, remoteServerId: 'nas-1' };
    for (const changes of [
      { userId: 'user-2' },
      { type: 'emby' as const },
      { remoteServerId: 'nas-2' },
    ]) {
      const incoming = prepareAuthenticatedServer([existing], {
        ...baseServer,
        remoteServerId: 'nas-1',
        address: 'https://another.test',
        ...changes,
      });
      expect(incoming.id).not.toBe(existing.id);
      expect(upsertMediaServer([existing], incoming)).toHaveLength(2);
    }
  });

  it('recognizes reauthentication through a saved alternative address without a remote identity', () => {
    const existing = {
      ...baseServer,
      connections: [{ id: 'lan', name: 'LAN', address: 'http://nas:8096' }],
    };
    const incoming = prepareAuthenticatedServer([existing], {
      ...baseServer,
      address: 'http://nas:8096/',
    });
    expect(incoming.id).toBe(existing.id);
    expect(incoming.connections).toHaveLength(2);
  });
  it('normalizes trailing slashes for server ids', () => {
    expect(normalizeServerAddress('https://media.test/')).toBe('https://media.test');
    expect(createMediaServerStorageId('https://media.test/', 'user-1')).toBe(
      'https://media.test_user-1',
    );
  });

  it('updates an existing server account without duplicating list keys', () => {
    const updated = upsertMediaServer(
      [baseServer],
      {
        ...baseServer,
        username: 'Renamed User',
        accessToken: 'token-2',
      },
      200,
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      username: 'Renamed User',
      accessToken: 'token-2',
      createdAt: 100,
    });
  });

  it('appends a new server account when no matching id exists', () => {
    const updated = upsertMediaServer(
      [baseServer],
      {
        ...baseServer,
        id: 'https://media.test_user-2',
        userId: 'user-2',
        username: 'User Two',
      },
      200,
    );

    expect(updated).toHaveLength(2);
    expect(updated[1]).toMatchObject({
      id: 'https://media.test_user-2',
      createdAt: 200,
    });
  });
});
