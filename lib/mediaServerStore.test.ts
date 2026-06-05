import type { MediaServerInfo } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  createMediaServerStorageId,
  normalizeServerAddress,
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
