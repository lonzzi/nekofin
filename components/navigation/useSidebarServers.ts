import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getCachedToolbarAvatar, getToolbarAvatar } from '@/modules/toolbar-avatar';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Only display data crosses the native sidebar boundary, never server sessions. */
export function useSidebarServers() {
  const { servers, homeServerId, setHomeServer } = useMediaServers();
  const [avatars, setAvatars] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    let active = true;
    const sources = [...new Set(servers.map((server) => server.userAvatar).filter(Boolean))];
    if (!sources.length) return;
    void Promise.allSettled(
      sources.map(async (source) => [source, await getToolbarAvatar(source)] as const),
    ).then((results) => {
      if (!active) return;
      setAvatars(
        new Map(results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))),
      );
    });
    return () => {
      active = false;
    };
  }, [servers]);

  const items = useMemo(
    () =>
      servers.map((server) => ({
        id: server.id,
        name: server.name,
        type: server.type,
        avatarUri:
          getCachedToolbarAvatar(server.userAvatar) ?? avatars.get(server.userAvatar) ?? '',
      })),
    [servers, avatars],
  );
  const selectServer = useCallback(
    (id: string) => {
      const server = servers.find((entry) => entry.id === id);
      if (server) setHomeServer(server);
      return !!server;
    },
    [servers, setHomeServer],
  );

  return { items, homeServerId, selectServer };
}
