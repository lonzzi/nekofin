import {
  createMediaAdapterWithApi,
  createMediaApiFromServerInfo,
  getMediaAdapter,
} from '@/services/media';
import { deleteCachedApiForServer } from '@/services/media/jellyfin';
import { MediaApi, MediaServerInfo, MediaServerType } from '@/services/media/types';
import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createMediaServerStorageId,
  normalizeServerAddress,
  upsertMediaServer,
} from '../mediaServerStore';
import { buildConnectionAddress } from '../serverConnection';
import { clearServerConnectionQueries } from '../serverConnectionQueries';
import {
  getServerConnections,
  hasSameServerSession,
  selectServerConnection,
  verifyServerConnection,
} from '../serverConnections';
import { storage } from '../storage';

interface MediaServerContextType {
  servers: MediaServerInfo[];
  currentServer: MediaServerInfo | null;
  currentApi: MediaApi | null;
  setCurrentServer: (server: MediaServerInfo) => void;
  isInitialized: boolean;
  addServer: (server: Omit<MediaServerInfo, 'id' | 'createdAt'>) => Promise<void>;
  authenticateAndAddServer: (params: {
    address: string;
    username: string;
    password: string;
    type?: MediaServerType;
    name?: string;
    note?: string;
  }) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  updateServer: (id: string, updates: Partial<MediaServerInfo>) => Promise<void>;
  getServer: (id: string) => MediaServerInfo | undefined;
  getServerByAddress: (address: string) => MediaServerInfo | undefined;
  refreshServerInfo: (id: string) => Promise<void>;
  homeServerId: string | null;
  setHomeServer: (server: MediaServerInfo | null) => void;
  saveConnection: (
    id: string,
    name: string,
    address: string,
    connectionId?: string,
  ) => Promise<void>;
  switchConnection: (id: string, connectionId: string) => Promise<void>;
  removeConnection: (id: string, connectionId: string) => Promise<void>;
}

const MediaServerContext = createContext<MediaServerContextType | undefined>(undefined);

const STORAGE_KEY = 'nekofin_servers';
const CURRENT_SERVER_ID_KEY = 'nekofin_current_server_id';
const HOME_SERVER_ID_KEY = 'nekofin_home_server_id';

export function MediaServerProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [servers, setServers] = useState<MediaServerInfo[]>([]);
  const serversRef = useRef(servers);
  const [homeServerId, setHomeServerId] = useState<string | null>(null);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const currentServer = useMemo(() => {
    return servers.find((server) => server.id === currentServerId) || null;
  }, [servers, currentServerId]);

  const currentApi = useMemo(() => {
    if (!currentServer) {
      return null;
    }
    try {
      return createMediaApiFromServerInfo(currentServer);
    } catch (error) {
      console.error('Failed to create API instance:', error);
      return null;
    }
  }, [currentServer]);

  const setCurrentServer = useCallback((server: MediaServerInfo) => {
    setCurrentServerId(server.id);
    storage.set(CURRENT_SERVER_ID_KEY, server.id);
  }, []);

  const setHomeServer = useCallback(
    (server: MediaServerInfo | null) => {
      setHomeServerId(server?.id ?? null);
      if (server) {
        storage.set(HOME_SERVER_ID_KEY, server.id);
        setCurrentServer(server);
      } else storage.delete(HOME_SERVER_ID_KEY);
    },
    [setCurrentServer],
  );

  const loadServers = useCallback(async () => {
    const stored = storage.getString(STORAGE_KEY);
    if (stored) {
      const parsedServers = JSON.parse(stored) as MediaServerInfo[];
      const normalizedServers = parsedServers.map((server) => ({
        ...server,
        address: normalizeServerAddress(server.address),
        connections: getServerConnections(server),
      }));
      serversRef.current = normalizedServers;
      setServers(normalizedServers);
      const homeId = storage.getString(HOME_SERVER_ID_KEY);
      setHomeServerId(normalizedServers.some((server) => server.id === homeId) ? homeId! : null);
      const persistedId = storage.getString(CURRENT_SERVER_ID_KEY) || null;
      if (persistedId && normalizedServers.some((s) => s.id === persistedId)) {
        setCurrentServerId(persistedId);
      } else if (normalizedServers.length > 0) {
        setCurrentServerId(normalizedServers[0].id);
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  const saveServers = useCallback(async (newServers: MediaServerInfo[]) => {
    serversRef.current = newServers;
    storage.set(STORAGE_KEY, JSON.stringify(newServers));
    setServers(newServers);
  }, []);

  const addServer = useCallback(
    async (server: Omit<MediaServerInfo, 'id' | 'createdAt'>) => {
      const normalizedAddress = normalizeServerAddress(server.address);
      const serverId = createMediaServerStorageId(normalizedAddress, server.userId);
      const newServer: Omit<MediaServerInfo, 'createdAt'> = {
        ...server,
        address: normalizedAddress,
        id: serverId,
      };

      const existing = serversRef.current.find((server) => server.id === serverId);
      if (existing && !hasSameServerSession(existing, newServer)) {
        await clearServerConnectionQueries(queryClient, serverId);
        deleteCachedApiForServer(serverId);
      }
      const updatedServers = upsertMediaServer(serversRef.current, {
        ...newServer,
        connections: newServer.connections ?? existing?.connections,
      });
      await saveServers(updatedServers);
      setCurrentServerId(newServer.id);
      storage.set(CURRENT_SERVER_ID_KEY, newServer.id);
    },
    [queryClient, saveServers],
  );

  const authenticateAndAddServer = useCallback(
    async ({
      address,
      username,
      password,
      type,
      name,
      note,
    }: {
      address: string;
      username: string;
      password: string;
      type?: MediaServerType;
      name?: string;
      note?: string;
    }) => {
      const normalizedAddress = normalizeServerAddress(address);
      const adapter = getMediaAdapter(type || 'jellyfin');
      await adapter.authenticateAndSaveServer({
        address: normalizedAddress,
        username,
        password,
        name,
        note,
        addServer,
      });
    },
    [addServer],
  );

  const removeServer = useCallback(
    async (id: string) => {
      await clearServerConnectionQueries(queryClient, id);
      const updatedServers = serversRef.current.filter((server) => server.id !== id);
      await saveServers(updatedServers);
      deleteCachedApiForServer(id);
      if (currentServerId === id) {
        const next = updatedServers[0]?.id || null;
        setCurrentServerId(next);
        if (next) {
          storage.set(CURRENT_SERVER_ID_KEY, next);
        } else {
          storage.delete(CURRENT_SERVER_ID_KEY);
        }
      }
      if (homeServerId === id) setHomeServer(null);
    },
    [currentServerId, homeServerId, queryClient, setHomeServer, saveServers],
  );

  const updateServer = useCallback(
    async (id: string, updates: Partial<MediaServerInfo>) => {
      const existing = serversRef.current.find((server) => server.id === id);
      if (!existing) return;
      const next = {
        ...existing,
        ...updates,
        address: updates.address ? normalizeServerAddress(updates.address) : existing.address,
      };
      if (!hasSameServerSession(existing, next)) {
        await clearServerConnectionQueries(queryClient, id);
        if (
          !hasSameServerSession(
            existing,
            serversRef.current.find((server) => server.id === id),
          )
        )
          throw new Error('服务器连接已更新，请重试');
        deleteCachedApiForServer(id);
      }
      const updatedServers = serversRef.current.map((server) =>
        server.id === id
          ? {
              ...server,
              ...updates,
              address: updates.address ? normalizeServerAddress(updates.address) : server.address,
              connections:
                updates.connections ??
                (updates.remoteServerId &&
                server.remoteServerId &&
                updates.remoteServerId !== server.remoteServerId
                  ? []
                  : server.connections),
            }
          : server,
      );
      await saveServers(updatedServers);
    },
    [queryClient, saveServers],
  );

  const requireUnchangedSession = useCallback((expected: MediaServerInfo) => {
    const current = serversRef.current.find((server) => server.id === expected.id);
    if (!current || !hasSameServerSession(expected, current))
      throw new Error('服务器连接已更新，请重试');
    return current;
  }, []);

  const verifyConnection = useCallback(async (server: MediaServerInfo, address: string) => {
    const remoteServerId = await verifyServerConnection(server, address);
    const adapter = createMediaAdapterWithApi(
      server.type,
      createMediaApiFromServerInfo({ ...server, address }, false),
    );
    const user = await adapter.getUserInfo({ userId: server.userId }).catch(() => {
      throw new Error('无法验证此线路的账号，请检查网络或重新登录');
    });
    if (user.id !== server.userId) throw new Error('此线路无法验证当前账号，请重新登录');
    return { remoteServerId, user };
  }, []);

  const saveConnection = useCallback(
    async (id: string, name: string, input: string, connectionId?: string) => {
      const server = serversRef.current.find((server) => server.id === id);
      if (!server) throw new Error('服务器不存在');
      const address = buildConnectionAddress(input);
      const connections = getServerConnections(server);
      if (connections.some((line) => line.address === address && line.id !== connectionId))
        throw new Error('这个地址已在服务器线路中');
      const { remoteServerId } = await verifyConnection(server, address);
      const latestConnections = getServerConnections(requireUnchangedSession(server));
      if (connectionId && !latestConnections.some((line) => line.id === connectionId))
        throw new Error('线路已被删除，请重试');
      if (latestConnections.some((line) => line.address === address && line.id !== connectionId))
        throw new Error('这个地址已在服务器线路中');
      const line = {
        id: connectionId ?? `line-${Date.now()}`,
        name: name.trim() || '备用线路',
        address,
      };
      if (
        connectionId &&
        connections.find((item) => item.id === connectionId)?.address === server.address &&
        address !== server.address
      )
        throw new Error('请先切换到其他线路，再修改当前线路的地址');
      await updateServer(id, {
        remoteServerId,
        connections: connectionId
          ? latestConnections.map((item) => (item.id === connectionId ? line : item))
          : [...latestConnections, line],
      });
    },
    [requireUnchangedSession, updateServer, verifyConnection],
  );

  const switchConnection = useCallback(
    async (id: string, connectionId: string) => {
      const server = serversRef.current.find((server) => server.id === id);
      if (!server) throw new Error('服务器不存在');
      const next = selectServerConnection(server, connectionId);
      if (next.address === server.address) return;
      const { remoteServerId, user } = await verifyConnection(server, next.address);
      const latest = requireUnchangedSession(server);
      const latestSelection = selectServerConnection(latest, connectionId);
      if (latestSelection.address !== next.address) throw new Error('线路地址已更新，请重试');
      await updateServer(id, {
        address: next.address,
        connections: latestSelection.connections,
        remoteServerId,
        userAvatar: user.avatar || '',
      });
    },
    [requireUnchangedSession, updateServer, verifyConnection],
  );

  const removeConnection = useCallback(
    async (id: string, connectionId: string) => {
      const server = serversRef.current.find((server) => server.id === id);
      if (!server) return;
      const connections = getServerConnections(server);
      if (connections.find((line) => line.id === connectionId)?.address === server.address)
        throw new Error('请先切换到其他线路，再删除当前线路');
      await updateServer(id, {
        connections: connections.filter((line) => line.id !== connectionId),
      });
    },
    [updateServer],
  );

  const getServer = useCallback(
    (id: string) => {
      return servers.find((server) => server.id === id);
    },
    [servers],
  );

  const getServerByAddress = useCallback(
    (address: string) => {
      const normalizedAddress = normalizeServerAddress(address);
      return servers.find((server) =>
        getServerConnections(server).some((line) => line.address === normalizedAddress),
      );
    },
    [servers],
  );

  const refreshServerInfo = useCallback(
    async (id: string) => {
      const server = serversRef.current.find((s) => s.id === id);
      if (!server) return;
      const api = createMediaApiFromServerInfo(server);
      const adapter = createMediaAdapterWithApi(server.type, api);
      const [system, user] = await Promise.all([
        adapter.getSystemInfo(),
        adapter.getUserInfo({ userId: server.userId }),
      ]);
      if (
        !hasSameServerSession(
          server,
          serversRef.current.find((item) => item.id === id),
        )
      )
        return;
      await updateServer(id, {
        name: server.name || system.serverName || user.serverName || server.address,
        username: user.name || server.username,
        userAvatar: user.avatar || '',
        remoteServerId: system.id || server.remoteServerId,
      });
    },
    [updateServer],
  );

  const value = useMemo<MediaServerContextType>(
    () => ({
      servers,
      currentServer,
      currentApi,
      setCurrentServer,
      isInitialized,
      addServer,
      authenticateAndAddServer,
      removeServer,
      updateServer,
      getServer,
      getServerByAddress,
      refreshServerInfo,
      homeServerId: servers.some((server) => server.id === homeServerId) ? homeServerId : null,
      setHomeServer,
      saveConnection,
      switchConnection,
      removeConnection,
    }),
    [
      addServer,
      authenticateAndAddServer,
      currentApi,
      currentServer,
      getServer,
      getServerByAddress,
      isInitialized,
      refreshServerInfo,
      removeServer,
      servers,
      setCurrentServer,
      updateServer,
      homeServerId,
      setHomeServer,
      saveConnection,
      switchConnection,
      removeConnection,
    ],
  );

  return <MediaServerContext.Provider value={value}>{children}</MediaServerContext.Provider>;
}

export function useMediaServers() {
  const context = useContext(MediaServerContext);
  if (context === undefined) {
    throw new Error('useServers must be used within a MediaServerProvider');
  }
  return context;
}
