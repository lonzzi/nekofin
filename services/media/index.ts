import type { Api } from '@jellyfin/sdk';

import { embyAdapter, EmbyAdapter } from './emby/embyAdapter';
import { EmbyApi } from './emby/index';
import { createApi, createApiFromServerInfo as createJellyfinApiFromServerInfo } from './jellyfin';
import { jellyfinAdapter, JellyfinAdapter } from './jellyfin/jellyfinAdapter';
import type { MediaAdapter, MediaServerInfo, MediaServerType } from './types';

export function getMediaAdapter(type: MediaServerType = 'jellyfin'): MediaAdapter {
  if (type === 'emby') return embyAdapter;
  return jellyfinAdapter;
}

export function createMediaAdapterWithApi(type: MediaServerType, api: Api | EmbyApi): MediaAdapter {
  if (type === 'emby') {
    const adapter = new EmbyAdapter();
    adapter.setApi(api as EmbyApi);
    return adapter;
  } else {
    const adapter = new JellyfinAdapter();
    adapter.setApi(api as Api);
    return adapter;
  }
}

export function createMediaApiFromServerInfo(
  serverInfo: MediaServerInfo,
  cached = true,
): Api | EmbyApi {
  if (serverInfo.type === 'emby') {
    return {
      basePath: serverInfo.address.replace(/\/$/, ''),
      accessToken: serverInfo.accessToken,
      ...(cached ? {} : { timeoutMs: 8000 }),
    };
  }

  if (cached) return createJellyfinApiFromServerInfo(serverInfo);
  const api = createApi(serverInfo.address);
  api.axiosInstance.defaults.timeout = 8000;
  api.accessToken = serverInfo.accessToken;
  return api;
}

export type { MediaAdapter, MediaServerType } from './types';
