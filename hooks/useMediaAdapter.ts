import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { createMediaAdapterWithApi, getMediaAdapter } from '@/services/media';
import { useMemo } from 'react';

export const useMediaAdapter = () => {
  const { currentApi, currentServer } = useMediaServers();
  const adapter = useMemo(() => {
    if (currentServer?.type && currentApi) {
      return createMediaAdapterWithApi(currentServer.type, currentApi);
    }
    return getMediaAdapter(currentServer?.type);
  }, [currentApi, currentServer?.type]);

  return adapter;
};
