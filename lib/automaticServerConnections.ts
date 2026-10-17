import type { MediaServerInfo } from '@/services/media/types';

import { getConnectionPolicy, resolveAutomaticConnection } from './serverConnections';

type Dependencies = {
  getServers: () => MediaServerInfo[];
  readNetwork: () => Promise<{ connected: boolean; wifi: boolean }>;
  isActive: () => boolean;
  verifyConnection: (server: MediaServerInfo, address: string) => Promise<unknown>;
  switchConnection: (
    id: string,
    connectionId: string,
    options: { automatic: boolean; isCurrent: () => boolean },
  ) => Promise<void>;
};

/** Discard old probes immediately when the network, app state, or route changes. */
export function createAutomaticConnectionMonitor(dependencies: Dependencies) {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const evaluate = async (version: number) => {
    const isCurrent = () => !disposed && generation === version && dependencies.isActive();
    try {
      const network = await dependencies.readNetwork();
      if (!isCurrent()) return;
      await Promise.all(
        dependencies.getServers().map(async (server) => {
          if (!getConnectionPolicy(server).enabled || !isCurrent()) return;
          const connectionId = await resolveAutomaticConnection(
            server,
            network,
            dependencies.verifyConnection,
          );
          if (connectionId && isCurrent())
            await dependencies
              .switchConnection(server.id, connectionId, { automatic: true, isCurrent })
              .catch(() => {});
        }),
      );
    } catch {
      // A failed OS/network query must not replace the last working address.
    }
  };
  return {
    schedule() {
      const version = ++generation;
      clearTimeout(timer);
      if (!disposed && dependencies.isActive())
        timer = setTimeout(() => void evaluate(version), 600);
    },
    dispose() {
      disposed = true;
      generation++;
      clearTimeout(timer);
    },
  };
}
