import { createAutomaticConnectionMonitor } from '@/lib/automaticServerConnections';
import type { MediaServerInfo } from '@/services/media/types';
import * as Network from 'expo-network';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

type Props = {
  servers: MediaServerInfo[];
  isInitialized: boolean;
  verifyConnection: (server: MediaServerInfo, address: string) => Promise<unknown>;
  switchConnection: (
    id: string,
    connectionId: string,
    options: { automatic: boolean; isCurrent: () => boolean },
  ) => Promise<void>;
};

export function useAutomaticServerConnections({
  servers,
  isInitialized,
  verifyConnection,
  switchConnection,
}: Props) {
  const pathname = usePathname();
  const serversRef = useRef(servers);
  serversRef.current = servers;
  // Keep the player's current API/session intact until playback ends.
  const suspended = /\/(player(?:-lab)?|add-server|server-line)(\/|$)/.test(pathname);
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  // Exclude the active address: an automatic switch is not a new configuration.
  const configuration = JSON.stringify(
    servers.map((server) => [
      server.id,
      server.type,
      server.remoteServerId,
      server.connectionPolicy,
      server.connections,
      server.accessToken,
    ]),
  );
  useEffect(() => {
    if (!isInitialized || suspended) return;
    const monitor = createAutomaticConnectionMonitor({
      getServers: () => serversRef.current,
      readNetwork: async () => {
        const network = await Network.getNetworkStateAsync();
        return {
          connected: network.isConnected === true,
          wifi: network.type === Network.NetworkStateType.WIFI,
        };
      },
      isActive: () => !suspendedRef.current && AppState.currentState === 'active',
      verifyConnection,
      switchConnection,
    });
    const networkSubscription = Network.addNetworkStateListener(() => monitor.schedule());
    const appSubscription = AppState.addEventListener('change', () => monitor.schedule());
    monitor.schedule();
    return () => {
      monitor.dispose();
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, [configuration, isInitialized, suspended, switchConnection, verifyConnection]);
}
