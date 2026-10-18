import type { MediaServerInfo } from '@/services/media/types';

import { getServerConnections } from './serverConnections';

type ServerIdentity = Pick<MediaServerInfo, 'type' | 'address' | 'remoteServerId' | 'connections'>;

export class ServerAccountError extends Error {}

export function isSameMediaServer(left: ServerIdentity, right: ServerIdentity) {
  if (left.type !== right.type) return false;
  if (left.remoteServerId && right.remoteServerId)
    return left.remoteServerId === right.remoteServerId;
  const addresses = new Set(getServerConnections(left).map((line) => line.address));
  return getServerConnections(right).some((line) => addresses.has(line.address));
}

/** Preserve saved account IDs: queries, preferences and playback belong to an account. */
export function groupServerAccounts(servers: MediaServerInfo[]) {
  const groups: MediaServerInfo[][] = [];
  for (const server of servers) {
    const matches = groups.filter(
      (accounts) =>
        accounts.some((account) => isSameMediaServer(account, server)) &&
        accounts.every(
          (account) =>
            !account.remoteServerId ||
            !server.remoteServerId ||
            account.remoteServerId === server.remoteServerId,
        ),
    );
    const group = matches[0];
    if (group) {
      group.push(server);
      for (const matching of matches.slice(1)) {
        const identity = group.find((account) => account.remoteServerId)?.remoteServerId;
        if (
          identity &&
          matching.some((account) => account.remoteServerId && account.remoteServerId !== identity)
        )
          continue;
        group.push(...matching);
        groups.splice(groups.indexOf(matching), 1);
      }
      group.sort((left, right) => servers.indexOf(left) - servers.indexOf(right));
    } else groups.push([server]);
  }
  return groups;
}

export function getActiveServerAccounts(servers: MediaServerInfo[], selectedIds: string[]) {
  return groupServerAccounts(servers).map(
    (accounts) =>
      selectedIds.map((id) => accounts.find((account) => account.id === id)).find(Boolean) ??
      accounts[0],
  );
}

export function selectServerAccountIds(
  servers: MediaServerInfo[],
  selectedIds: string[],
  server: MediaServerInfo,
) {
  return [
    server.id,
    ...getActiveServerAccounts(servers, selectedIds)
      .filter((account) => !isSameMediaServer(account, server))
      .map((account) => account.id),
  ];
}

export function assertSameServerAccount(
  existing: MediaServerInfo,
  authenticated: Omit<MediaServerInfo, 'id' | 'createdAt'>,
) {
  if (existing.userId !== authenticated.userId || !isSameMediaServer(existing, authenticated))
    throw new ServerAccountError('请使用原账号重新登录；如需使用其他账号，请选择“添加账号”。');
}
