import type { DiagnosticData } from '@/lib/performance/diagnosticReport';
import type { PerformanceEventStatus } from '@/lib/performance/performanceMetrics';
import {
  usePerformanceMonitorActions,
  usePerformanceMonitorSettings,
} from '@/lib/performance/PerformanceMonitorContext';
import type { RawMediaSource } from '@/services/media/mappers';
import type { PlaybackSelection } from '@/services/media/playbackSelection';
import type { ExpoMpvViewRef, PlaybackState, ProgressEvent } from 'expo-mpv';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { activeDecoderStatus, createPlaybackDiagnosticSampler } from './playbackDiagnostics';
import type { PlaybackSourceInfo } from './playbackInfo';

type Source = RawMediaSource & {
  Path?: string | null;
  RunTimeTicks?: number | null;
};

export function usePlaybackDiagnostics({
  context,
  player,
  itemId,
  title,
  source,
  url,
  selection,
  sourceInfo,
  loaded,
  buffering,
  state,
  appActive,
}: {
  context: object;
  player: RefObject<ExpoMpvViewRef | null>;
  itemId: string;
  title: string;
  source?: Source;
  url: string | null;
  selection: PlaybackSelection;
  sourceInfo: PlaybackSourceInfo;
  loaded: boolean;
  buffering: boolean;
  state: PlaybackState;
  appActive: boolean;
}) {
  const { recordEvent } = usePerformanceMonitorActions();
  const { enabled } = usePerformanceMonitorSettings();
  const progress = useRef<ProgressEvent | null>(null);
  const latest = useRef({ context, loaded, buffering, state, appActive });
  useEffect(() => {
    latest.current = { context, loaded, buffering, state, appActive };
  }, [context, loaded, buffering, state, appActive]);
  const [sessionId] = useState(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const record = useCallback(
    (name: string, data: DiagnosticData = {}, status: PerformanceEventStatus = 'ok') => {
      if (!enabled) return;
      recordEvent({ name, type: 'playback', status, data: { sessionId, itemId, ...data } });
    },
    [enabled, recordEvent, sessionId, itemId],
  );
  const descriptor = useMemo(
    () => ({
      title,
      mediaSource: {
        id: source?.Id,
        name: source?.Name,
        fileName: source?.Path?.replace(/\\/g, '/').split('/').pop(),
        container: source?.Container,
        sizeBytes: source?.Size,
        durationTicks: source?.RunTimeTicks,
      },
      url,
      selection,
      delivery: sourceInfo,
      streams: source?.MediaStreams?.map((stream) => ({
        index: stream.Index,
        type: stream.Type,
        codec: stream.Codec,
        language: stream.Language,
        title: stream.DisplayTitle,
        external: stream.IsExternal,
        deliveryMethod: stream.DeliveryMethod,
        width: stream.Width,
        height: stream.Height,
        bitrate: stream.BitRate,
        bitDepth: stream.BitDepth,
        pixelFormat: stream.PixelFormat,
        channels: stream.Channels,
        sampleRate: stream.SampleRate,
      })),
    }),
    [title, source, url, selection, sourceInfo],
  );
  const currentDescriptor = useRef(descriptor);
  useEffect(() => {
    currentDescriptor.current = descriptor;
  }, [descriptor]);

  useEffect(() => {
    if (!enabled) return;
    progress.current = null;
    record('player.source', currentDescriptor.current);
    return () => {
      record('player.session.closed', { progress: progress.current });
    };
  }, [context, enabled, record]);

  useEffect(() => {
    if (!enabled || !loaded) return;
    const target = player.current;
    if (!target) return;
    let disposed = false;
    const active = () =>
      !disposed && latest.current.context === context && player.current === target;
    const sample = createPlaybackDiagnosticSampler({
      active,
      record,
      read: async () => {
        const media = await target.getMediaInfo();
        if (!active()) return {};
        const trackIds = await target.getCurrentTrackIds();
        if (!active()) return {};
        const playback = await target.getPlaybackInfo();
        const { title, mediaSource, url, selection, delivery } = currentDescriptor.current;
        return {
          title,
          mediaSource,
          url,
          selection,
          delivery,
          native: { ...media, decoderStatus: activeDecoderStatus(media), trackIds, playback },
          progress: progress.current,
          loaded: latest.current.loaded,
          buffering: latest.current.buffering,
          state: latest.current.state,
          appActive: latest.current.appActive,
        };
      },
    });
    void sample();
    const timer = setInterval(() => {
      void sample();
    }, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [context, enabled, loaded, player, record]);

  useEffect(() => {
    if (!enabled || !url || (loaded && !buffering)) return;
    const timer = setTimeout(
      () =>
        record(
          loaded ? 'player.buffering.waiting' : 'player.load.waiting',
          {
            ...currentDescriptor.current,
            progress: progress.current,
            state: latest.current.state,
            elapsedMs: 15_000,
          },
          'slow',
        ),
      15_000,
    );
    return () => clearTimeout(timer);
  }, [enabled, url, loaded, buffering, record]);

  const recordProgress = useCallback(
    (event: ProgressEvent) => {
      if (enabled) progress.current = event;
    },
    [enabled],
  );
  return useMemo(() => ({ record, recordProgress }), [record, recordProgress]);
}
