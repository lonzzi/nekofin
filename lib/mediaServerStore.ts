import type { MediaServerInfo } from '@/services/media/types';

export function normalizeServerAddress(address: string): string {
  return address.replace(/\/$/, '');
}

export function createMediaServerStorageId(address: string, userId: string) {
  return `${normalizeServerAddress(address)}_${userId}`;
}

export function upsertMediaServer(
  servers: MediaServerInfo[],
  server: Omit<MediaServerInfo, 'createdAt'>,
  now = Date.now(),
) {
  const existingServer = servers.find((item) => item.id === server.id);
  const nextServer: MediaServerInfo = {
    ...server,
    createdAt: existingServer?.createdAt ?? now,
  };

  return existingServer
    ? servers.map((item) => (item.id === server.id ? nextServer : item))
    : [...servers, nextServer];
}
