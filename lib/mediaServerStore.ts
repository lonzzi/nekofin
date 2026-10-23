import type { MediaServerInfo } from '@/services/media/types';

import { isSameMediaServer } from './serverAccounts';
import { normalizeConnectionName } from './serverConnectionNames';
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
    (server) => server.userId === authenticated.userId && isSameMediaServer(server, authenticated),
  );
  const connections = existing
    ? [...getServerConnections(existing)]
    : (authenticated.connections ?? []).map(normalizeConnectionName);
  if (!connections.some((line) => line.address === address)) {
    connections.push({
      id: existing ? `address-${address}` : 'default',
      name: '',
      nameKind: existing ? 'alternative' : 'default',
      address,
    });
  }
  let id = existing?.id ?? createMediaServerStorageId(address, authenticated.userId);
  // Legacy IDs omitted the server type/identity. Never overwrite another saved account.
  if (!existing && servers.some((server) => server.id === id)) {
    const baseId = `${id}_${authenticated.type}_${authenticated.remoteServerId ?? 'server'}`;
    id = baseId;
    let suffix = 2;
    while (servers.some((server) => server.id === id)) id = `${baseId}_${suffix++}`;
  }
  return {
    ...existing,
    ...authenticated,
    id,
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
