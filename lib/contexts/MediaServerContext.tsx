import {
  createMediaAdapterWithApi,
  createMediaApiFromServerInfo,
  getMediaAdapter,
} from '@/services/media';
import { deleteCachedApiForServer } from '@/services/media/jellyfin';
import { MediaApi, MediaServerInfo, MediaServerType } from '@/services/media/types';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

function normalizeServerAddress(address: string): string {
  return address.replace(/\/$/, '');
}

export function MediaServerProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<MediaServerInfo[]>([]);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    loadServers();
  }, []);

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

  const setCurrentServer = (server: MediaServerInfo) => {
    setCurrentServerId(server.id);
    storage.set(CURRENT_SERVER_ID_KEY, server.id);
  };

  const loadServers = async () => {
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
  };

  const saveServers = async (newServers: MediaServerInfo[]) => {
    storage.set(STORAGE_KEY, JSON.stringify(newServers));
    setServers(newServers);
  };

  const addServer = async (server: Omit<MediaServerInfo, 'id' | 'createdAt'>) => {
    const normalizedAddress = normalizeServerAddress(server.address);
    const newServer: MediaServerInfo = {
      ...server,
      address: normalizedAddress,
      id: `${normalizedAddress}_${server.userId}`,
      createdAt: Date.now(),
    };

    const updatedServers = [...servers, newServer];
    await saveServers(updatedServers);
    setCurrentServerId(newServer.id);
    storage.set(CURRENT_SERVER_ID_KEY, newServer.id);
  };

  const authenticateAndAddServer = async ({
    address,
    username,
    password,
    type,
  }: {
    address: string;
    username: string;
    password: string;
    type?: MediaServerType;
  }) => {
    const normalizedAddress = normalizeServerAddress(address);
    const adapter = getMediaAdapter(type || 'jellyfin');
    await adapter.authenticateAndSaveServer({
      address: normalizedAddress,
      username,
      password,
      addServer,
    });
  };

  const removeServer = async (id: string) => {
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
  };

  const updateServer = async (id: string, updates: Partial<MediaServerInfo>) => {
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
  };

  const getServer = (id: string) => {
    return servers.find((server) => server.id === id);
  };

  const getServerByAddress = (address: string) => {
    const normalizedAddress = normalizeServerAddress(address);
    return servers.find((server) => server.address === normalizedAddress);
  };

  const refreshServerInfo = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    const api = createMediaApiFromServerInfo(server);
    const adapter = createMediaAdapterWithApi(server.type, api);
    const system = await adapter.getSystemInfo();
    const user = await adapter.getUserInfo({ userId: server.userId });
    await updateServer(id, {
      name: system.serverName || user.serverName || server.address,
      username: user.name || server.username,
      userAvatar: user.avatar || server.userAvatar,
    });
  };

  const value: MediaServerContextType = {
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
  };

  return <MediaServerContext.Provider value={value}>{children}</MediaServerContext.Provider>;
}

export function useMediaServers() {
  const context = useContext(MediaServerContext);
  if (context === undefined) {
    throw new Error('useServers must be used within a MediaServerProvider');
  }
  return context;
}
