import { invalidatePlaybackWatchState } from '@/services/media/cache';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { SharedValue } from 'react-native-reanimated';

import { sendPlaybackReport } from './playbackReporting';
import { useMediaAdapter } from './useMediaAdapter';

interface UsePlaybackSyncProps {
  currentServer: MediaServerInfo | null;
  itemDetail: MediaItem | null;
  currentTime: SharedValue<number>;
  playSessionId: string | null;
  mediaSourceId?: string;
}

export const usePlaybackSync = ({
  currentServer,
  itemDetail,
  currentTime,
  playSessionId,
  mediaSourceId,
}: UsePlaybackSyncProps) => {
  const mediaAdapter = useMediaAdapter();
  const queryClient = useQueryClient();
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
      void sendPlaybackReport('progress', () =>
        mediaAdapter.reportPlaybackProgress({
          itemId: itemDetail.id!,
          mediaSourceId,
          positionTicks,
          isPaused,
          PlaySessionId: playSessionId,
        }),
      );
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId, mediaSourceId],
  );

  const syncPlaybackStart = useCallback(
    (positionMs: number) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      const positionTicks = Math.round(positionMs);
      lastProgressReportRef.current = { position: positionMs, ts: Date.now() };
      void sendPlaybackReport('start', () =>
        mediaAdapter.reportPlaybackStart({
          itemId: itemDetail.id!,
          mediaSourceId,
          positionTicks,
          PlaySessionId: playSessionId,
        }),
      );
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId, mediaSourceId],
  );

  const syncPlaybackStop = useCallback(
    (positionMs: number) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      lastProgressReportRef.current = { position: positionMs, ts: Date.now() };
      const positionTicks = Math.round(positionMs);
      void sendPlaybackReport('stop', async () => {
        await mediaAdapter.reportPlaybackStop({
          itemId: itemDetail.id!,
          mediaSourceId,
          positionTicks,
          PlaySessionId: playSessionId,
        });
        await invalidatePlaybackWatchState(queryClient, currentServer.id, itemDetail.id);
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId, mediaSourceId, queryClient],
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
