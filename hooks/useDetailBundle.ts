import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import {
  detailBundleQueryOptions,
  type DetailBundle,
  type DetailBundleMode,
} from '@/services/media/queryOptions';

import { useMediaAdapter } from './useMediaAdapter';
import { useQueryWithFocus } from './useQueryWithFocus';

export type { DetailBundle };

export function useDetailBundle(mode: DetailBundleMode, itemId: string) {
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const query = useQueryWithFocus({
    ...detailBundleQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      mode,
      itemId,
    }),
    refetchOnScreenFocus: 'stale',
  });

  return query;
}
