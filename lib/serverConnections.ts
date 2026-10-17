import type {
  MediaServerConnection,
  MediaServerInfo,
  MediaServerType,
} from '@/services/media/types';

import { buildConnectionAddress } from './serverConnection';

type ServerSession = Pick<MediaServerInfo, 'id' | 'type' | 'address' | 'userId' | 'accessToken'>;

/** Metadata can change while a request is pending; account credentials must not. */
export function hasSameServerSession(expected: ServerSession, current?: ServerSession) {
  return (
    !!current &&
    expected.id === current.id &&
    expected.type === current.type &&
    expected.address === current.address &&
    expected.userId === current.userId &&
    expected.accessToken === current.accessToken
  );
}

/** The account id stays stable when its active address changes. */
export function getServerConnections(server: MediaServerInfo): MediaServerConnection[] {
  const connections = server.connections ?? [];
  const address = server.address.replace(/\/+$/, '');
  return connections.some((line) => line.address === address)
    ? connections
    : [
        { id: connections.length ? `default-${address}` : 'default', name: '默认线路', address },
        ...connections,
      ];
}

export function selectServerConnection(server: MediaServerInfo, connectionId: string) {
  const connections = getServerConnections(server);
  const line = connections.find((connection) => connection.id === connectionId);
  if (!line) throw new Error('线路不存在');
  return {
    ...server,
    address: line.address,
    connections,
    userAvatar: server.userAvatar
      ? `${line.address}/Users/${server.userId}/Images/Primary?quality=90`
      : '',
  };
}

export async function getPublicServerInfo(address: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${buildConnectionAddress(address)}/System/Info/Public`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('连接失败，请检查线路地址、端口和网络');
    const info = await response.json();
    if (typeof info.Id !== 'string' || !info.Id)
      throw new Error('这个地址没有返回有效的媒体服务器信息');
    return {
      id: info.Id as string,
      name: typeof info.ServerName === 'string' ? info.ServerName : '',
      version: typeof info.Version === 'string' ? info.Version : '',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('线路连接超时，请检查地址和网络');
    if (error instanceof TypeError) throw new Error('无法连接此线路，请检查地址和网络');
    if (error instanceof SyntaxError) throw new Error('这个地址没有返回有效的媒体服务器信息');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPublicServerIdentity(address: string): Promise<string> {
  return (await getPublicServerInfo(address)).id;
}

export async function connectToMediaServer(
  input: string,
  type: MediaServerType,
  readInfo = getPublicServerInfo,
) {
  const address = buildConnectionAddress(input);
  try {
    return { ...(await readInfo(address)), address };
  } catch (error) {
    // Some Emby deployments only expose their API under /emby.
    if (type !== 'emby' || /\/emby$/i.test(address)) throw error;
    const prefixed = `${address}/emby`;
    return { ...(await readInfo(prefixed)), address: prefixed };
  }
}

export function getConnectionPolicy(server: MediaServerInfo) {
  const connections = getServerConnections(server);
  const policy = server.connectionPolicy;
  const defaultConnectionId = connections.some((line) => line.id === policy?.defaultConnectionId)
    ? policy!.defaultConnectionId
    : connections[0].id;
  const localConnectionId = connections.find(
    (line) => line.id === policy?.localConnectionId && line.id !== defaultConnectionId,
  )?.id;
  return {
    enabled: !!policy?.enabled && !!localConnectionId,
    defaultConnectionId,
    localConnectionId,
  };
}

/** No account token is sent until a LAN endpoint has passed the identity check. */
export async function resolveAutomaticConnection(
  server: MediaServerInfo,
  network: { connected: boolean; wifi: boolean },
  verify: (server: MediaServerInfo, address: string) => Promise<unknown>,
) {
  const policy = getConnectionPolicy(server);
  if (!policy.enabled || !network.connected) return null;
  if (network.wifi && policy.localConnectionId) {
    const local = selectServerConnection(server, policy.localConnectionId);
    try {
      await verify(server, local.address);
      return policy.localConnectionId;
    } catch {
      // Another Wi-Fi network may use the same private IP, or the NAS may be offline.
    }
  }
  return policy.defaultConnectionId;
}

/** Verify identity without credentials before using this account on another endpoint. */
export async function verifyServerConnection(
  server: MediaServerInfo,
  address: string,
  readIdentity = getPublicServerIdentity,
) {
  const expected = server.remoteServerId || (await readIdentity(server.address));
  const actual = await readIdentity(address);
  if (expected !== actual) throw new Error('此线路连接到了另一台服务器，请填写同一服务器的地址');
  return expected;
}
