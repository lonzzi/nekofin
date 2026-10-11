import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import type { MediaServerInfo } from '@/services/media/types';
import { useMemo } from 'react';

export function useMediaServerSources(servers: MediaServerInfo[]) {
  return useMemo(
    () =>
      servers.map((server) => ({
        server,
        adapter: createMediaAdapterWithApi(server.type, createMediaApiFromServerInfo(server)),
      })),
    [servers],
  );
}
