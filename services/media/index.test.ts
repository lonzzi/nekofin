import { describe, expect, it, vi } from 'vitest';

import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '.';
import { EmbyAdapter } from './emby/embyAdapter';
import { JellyfinAdapter } from './jellyfin/jellyfinAdapter';
import type { MediaServerInfo } from './types';

vi.mock('@/lib/utils', () => ({
  getDeviceId: () => 'device-1',
}));

const baseServer: MediaServerInfo = {
  id: 'server-1',
  address: 'https://media.test/',
  name: 'Media',
  userId: 'user-1',
  username: 'User One',
  userAvatar: '',
  accessToken: 'token-1',
  createdAt: 1,
  type: 'emby',
};

describe('media factories', () => {
  it('creates pure Emby api objects from stored server info', () => {
    expect(createMediaApiFromServerInfo(baseServer)).toEqual({
      basePath: 'https://media.test',
      accessToken: 'token-1',
    });
  });

  it('creates bound adapter instances for each server type', () => {
    expect(
      createMediaAdapterWithApi('emby', { basePath: 'https://emby.test', accessToken: null }),
    ).toBeInstanceOf(EmbyAdapter);

    const jellyfinApi = createMediaApiFromServerInfo({
      ...baseServer,
      type: 'jellyfin',
    });

    expect(createMediaAdapterWithApi('jellyfin', jellyfinApi)).toBeInstanceOf(JellyfinAdapter);
  });
});
