import { getDeviceId } from '@/lib/utils';
import { Api, Jellyfin, RecommendedServerInfo } from '@jellyfin/sdk';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api';

import { MediaServerInfo } from '../types';

let jellyfin: Jellyfin | null = null;
let apiInstancesByServerId: Record<string, Api> = {};

export function getJellyfinInstance() {
  if (!jellyfin) {
    jellyfin = new Jellyfin({
      clientInfo: {
        name: 'Nekofin',
        version: '1.0.0',
      },
      deviceInfo: {
        name: 'Nekofin Device',
        id: getDeviceId(),
      },
    });
  }
  return jellyfin;
}

export async function discoverServers(host: string) {
  const jellyfin = getJellyfinInstance();
  return await jellyfin.discovery.getRecommendedServerCandidates(host);
}

export function findBestServer(servers: RecommendedServerInfo[]) {
  const jellyfin = getJellyfinInstance();
  return jellyfin.discovery.findBestServer(servers);
}

export function createApi(address: string) {
  const jellyfin = getJellyfinInstance();
  const api = jellyfin.createApi(address);
  return api;
}

export async function login(api: Api, username: string, password: string) {
  return await api.authenticateUserByName(username, password);
}

export function getApiInstances() {
  return apiInstancesByServerId;
}

export function getCachedApiByServerId(serverId: string) {
  return apiInstancesByServerId[serverId] ?? null;
}

export function setCachedApiForServer(serverId: string, api: Api) {
  apiInstancesByServerId[serverId] = api;
}

export function deleteCachedApiForServer(serverId: string) {
  delete apiInstancesByServerId[serverId];
}

export function createApiFromServerInfo(serverInfo: MediaServerInfo) {
  const key = serverInfo.id || `${serverInfo.address}_${serverInfo.userId}`;
  const existing = key ? apiInstancesByServerId[key] : undefined;

  if (existing) {
    if (existing.basePath !== serverInfo.address) {
      const recreated = createApi(serverInfo.address);
      recreated.accessToken = serverInfo.accessToken;
      apiInstancesByServerId[key] = recreated;
      return recreated;
    }

    existing.accessToken = serverInfo.accessToken;
    return existing;
  }

  const jf = getJellyfinInstance();
  const api = jf.createApi(serverInfo.address);
  api.accessToken = serverInfo.accessToken;
  if (key) apiInstancesByServerId[key] = api;
  return api;
}

export async function authenticateAndSaveServer(
  address: string,
  username: string,
  password: string,
  addServer: (server: Omit<MediaServerInfo, 'id' | 'createdAt'>) => Promise<void>,
) {
  const api = createApi(address);
  const authResult = await login(api, username, password);

  if (authResult.data?.User?.Id && authResult.data?.AccessToken) {
    const normalizedAddress = address.replace(/\/$/, '');
    const systemInfo = await getSystemApi(api).getPublicSystemInfo();
    const serverInfo: Omit<MediaServerInfo, 'id' | 'createdAt'> = {
      address: normalizedAddress,
      name: systemInfo.data?.ServerName || normalizedAddress,
      userId: authResult.data.User.Id,
      username: authResult.data.User.Name || username,
      userAvatar: `${normalizedAddress}/Users/${authResult.data.User.Id}/Images/Primary?quality=90`,
      accessToken: authResult.data.AccessToken,
      type: 'jellyfin',
    };

    await addServer(serverInfo);
    return authResult;
  }

  throw new Error('Authentication failed');
}
