import {
  createMediaAdapterWithApi,
  createMediaApiFromServerInfo,
  getMediaAdapter,
} from '@/services/media';
import { deleteCachedApiForServer } from '@/services/media/jellyfin';
import { MediaApi, MediaServerInfo, MediaServerType } from '@/services/media/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  createMediaServerStorageId,
  normalizeServerAddress,
  upsertMediaServer,
} from '../mediaServerStore';
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
}

const MediaServerContext = createContext<MediaServerContextType | undefined>(undefined);

const STORAGE_KEY = 'nekofin_servers';
const CURRENT_SERVER_ID_KEY = 'nekofin_current_server_id';

export function MediaServerProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<MediaServerInfo[]>([]);
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

  const loadServers = useCallback(async () => {
    const stored = storage.getString(STORAGE_KEY);
    if (stored) {
      const parsedServers = JSON.parse(stored) as MediaServerInfo[];
      const normalizedServers = parsedServers.map((server) => ({
        ...server,
        address: normalizeServerAddress(server.address),
      }));
      setServers(normalizedServers);
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

      const updatedServers = upsertMediaServer(servers, newServer);
      await saveServers(updatedServers);
      setCurrentServerId(newServer.id);
      storage.set(CURRENT_SERVER_ID_KEY, newServer.id);
    },
    [saveServers, servers],
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
      const updatedServers = servers.filter((server) => server.id !== id);
      await saveServers(updatedServers);
      const removed = servers.find((s) => s.id === id);
      if (removed?.type === 'jellyfin') {
        deleteCachedApiForServer(id);
      }
      if (currentServerId === id) {
        const next = updatedServers[0]?.id || null;
        setCurrentServerId(next);
        if (next) {
          storage.set(CURRENT_SERVER_ID_KEY, next);
        } else {
          storage.delete(CURRENT_SERVER_ID_KEY);
        }
      }
    },
    [currentServerId, saveServers, servers],
  );

  const updateServer = useCallback(
    async (id: string, updates: Partial<MediaServerInfo>) => {
      const updatedServers = servers.map((server) =>
        server.id === id
          ? {
              ...server,
              ...updates,
              address: updates.address ? normalizeServerAddress(updates.address) : server.address,
            }
          : server,
      );
      await saveServers(updatedServers);
    },
    [saveServers, servers],
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
      return servers.find((server) => server.address === normalizedAddress);
    },
    [servers],
  );

  const refreshServerInfo = useCallback(
    async (id: string) => {
      const server = servers.find((s) => s.id === id);
      if (!server) return;
      const api = createMediaApiFromServerInfo(server);
      const adapter = createMediaAdapterWithApi(server.type, api);
      const [system, user] = await Promise.all([
        adapter.getSystemInfo(),
        adapter.getUserInfo({ userId: server.userId }),
      ]);
      await updateServer(id, {
        name: system.serverName || user.serverName || server.address,
        username: user.name || server.username,
        userAvatar: user.avatar || server.userAvatar,
      });
    },
    [servers, updateServer],
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
