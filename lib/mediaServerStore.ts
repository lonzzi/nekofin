import type { MediaServerInfo } from '@/services/media/types';

import { getServerConnections } from './serverConnections';

export function normalizeServerAddress(address: string): string {
  return address.replace(/\/$/, '');
}

export function createMediaServerStorageId(address: string, userId: string) {
  return `${normalizeServerAddress(address)}_${userId}`;
}

/** Multiple URLs for the same remote server and user represent one saved account. */
export function prepareAuthenticatedServer(
  servers: MediaServerInfo[],
  authenticated: Omit<MediaServerInfo, 'id' | 'createdAt'>,
): Omit<MediaServerInfo, 'createdAt'> {
  const address = normalizeServerAddress(authenticated.address);
  const existing = servers.find(
    (server) =>
      server.type === authenticated.type &&
      server.userId === authenticated.userId &&
      (server.remoteServerId && authenticated.remoteServerId
        ? server.remoteServerId === authenticated.remoteServerId
        : getServerConnections(server).some((line) => line.address === address)),
  );
  const connections = existing ? [...getServerConnections(existing)] : [];
  if (!connections.some((line) => line.address === address)) {
    connections.push({
      id: existing ? `address-${address}` : 'default',
      name: existing ? '备用线路' : '默认线路',
      address,
    });
  }
  return {
    ...existing,
    ...authenticated,
    id: existing?.id ?? createMediaServerStorageId(address, authenticated.userId),
    address,
    name: existing?.name ?? authenticated.name,
    note: authenticated.note ?? existing?.note,
    connections,
  };
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
