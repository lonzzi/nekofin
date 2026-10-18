import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { createSubtitleFontSession } from '@/services/media/subtitleFontCache';
import type { MediaSource } from '@/services/media/types';
import { useEffect, useState } from 'react';

import { useCustomSubtitleFonts } from './useCustomSubtitleFonts';

export function useSubtitleFonts(itemId: string, source?: MediaSource, enabled = true) {
  const { currentServer, currentApi } = useMediaServers();
  const { selected } = useCustomSubtitleFonts();
  const [ready, setReady] = useState<{ key: string; directory: string }>();
  const serverId = currentServer?.id;
  const userId = currentServer?.userId;
  const type = currentServer?.type;
  const basePath = currentApi?.basePath;
  const accessToken = currentApi?.accessToken ?? null;
  const hasSubtitles = source?.mediaStreams.some((stream) => stream.type === 'Subtitle');
  const key = JSON.stringify([serverId, userId, itemId, source, selected?.id]);
  useEffect(() => {
    if (!enabled || !hasSubtitles || !serverId || !userId || !type || !basePath || !source) return;
    const session = createSubtitleFontSession({ serverId, userId });
    let active = true;
    const request = {
      api: { basePath, accessToken },
      type,
      itemId,
      source,
      customFont: selected
        ? {
            name: `${selected.id}.${selected.extension}`,
            url: selected.uri,
            revision: selected.id,
            size: selected.size,
          }
        : undefined,
    };
    const publish = (directory?: string) => {
      if (active && directory) setReady({ key, directory });
    };
    // A local choice is usable immediately, even while the server font list is offline.
    void (async () => {
      if (selected) publish(await session.prepare({ ...request, localOnly: true }));
      return session.prepare(request);
    })()
      .then((directory) => {
        publish(directory);
      })
      .catch(() => {});
    return () => {
      active = false;
      session.dispose();
    };
  }, [
    enabled,
    hasSubtitles,
    serverId,
    userId,
    type,
    basePath,
    accessToken,
    itemId,
    source,
    key,
    selected,
  ]);
  return {
    directory: enabled && ready?.key === key ? ready.directory : undefined,
    family: selected?.family,
  };
}
