import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useCallback, useEffect, useRef } from 'react';
import { SharedValue } from 'react-native-reanimated';

import { useMediaAdapter } from './useMediaAdapter';

interface UsePlaybackSyncProps {
  currentServer: MediaServerInfo | null;
  itemDetail: MediaItem | null;
  currentTime: SharedValue<number>;
  playSessionId: string | null;
}

export const usePlaybackSync = ({
  currentServer,
  itemDetail,
  currentTime,
  playSessionId,
}: UsePlaybackSyncProps) => {
  const mediaAdapter = useMediaAdapter();
  const lastProgressReportRef = useRef<{ position: number; ts: number } | null>(null);

  const syncPlaybackProgress = useCallback(
    (positionMs: number, isPaused: boolean = false, options?: { force?: boolean }) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      const now = Date.now();
      const lastReport = lastProgressReportRef.current;
      const shouldReport =
        options?.force ||
        isPaused ||
        !lastReport ||
        now - lastReport.ts >= 5000 ||
        Math.abs(positionMs - lastReport.position) >= 15000;

      if (!shouldReport) return;

      const positionTicks = Math.round(positionMs);
      lastProgressReportRef.current = { position: positionMs, ts: now };
      mediaAdapter.reportPlaybackProgress({
        itemId: itemDetail.id!,
        positionTicks,
        isPaused,
        PlaySessionId: playSessionId,
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId],
  );

  const syncPlaybackStart = useCallback(
    (positionMs: number) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      const positionTicks = Math.round(positionMs);
      lastProgressReportRef.current = { position: positionMs, ts: Date.now() };
      mediaAdapter.reportPlaybackStart({
        itemId: itemDetail.id!,
        positionTicks,
        PlaySessionId: playSessionId,
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId],
  );

  const syncPlaybackStop = useCallback(
    (positionMs: number) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      lastProgressReportRef.current = { position: positionMs, ts: Date.now() };
      const positionTicks = Math.round(positionMs);
      mediaAdapter.reportPlaybackStop({
        itemId: itemDetail.id!,
        positionTicks,
        PlaySessionId: playSessionId,
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId],
  );

  useEffect(() => {
    return () => {
      if (currentServer && itemDetail && playSessionId) {
        syncPlaybackStop(currentTime.value);
      }
    };
  }, [mediaAdapter, currentServer, itemDetail, playSessionId, syncPlaybackStop, currentTime]);

  return {
    syncPlaybackProgress,
    syncPlaybackStart,
    syncPlaybackStop,
  };
};
