import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { createMediaAdapterWithApi, getMediaAdapter } from '@/services/media';
import { useMemo } from 'react';

export const useMediaAdapter = () => {
  const { currentApi, currentServer } = useMediaServers();
  const serverType = currentServer?.type;
  const adapter = useMemo(() => {
    if (serverType && currentApi) {
      return createMediaAdapterWithApi(serverType, currentApi);
    }
    return getMediaAdapter(serverType);
  }, [currentApi, serverType]);

  return adapter;
};
