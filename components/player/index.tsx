// @refresh reset

import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import { formatBitrate, getDeviceId, ticksToMilliseconds, ticksToSeconds } from '@/lib/utils';
import { DandanComment } from '@/services/dandanplay';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  ExpoMpvView,
  type ExpoMpvViewRef,
  type HdrStateChangeEvent,
  type PlaybackState,
  type TrackInfo,
} from 'expo-mpv';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { Controls } from './Controls';
import { DanmakuLayer, DanmakuLayerRef } from './DanmakuLayer';
import {
  acknowledgePlaybackSeek,
  createPlaybackSeekGateState,
  evaluatePlaybackProgress,
  failPlaybackSeek,
  PLAYBACK_SEEK_WATCHDOG_MS,
  recoverTimedOutPlaybackSeek,
  requestPlaybackSeek,
  resolvePlaybackSeekCommand,
  type PlaybackSeekCompletion,
} from './playbackSeekGate';
import {
  deriveBufferedProgress,
  deriveDurationMs,
  deriveEpisodeNavigation,
  deriveExternalAudio,
  deriveExternalSubtitles,
  formatPlayerTitle,
} from './playerDerived';
import { usePlayerQueries } from './usePlayerQueries';

type BufferInfo = { percent: number; rate: number };

const LoadingIndicator = ({
  title,
  bufferInfo,
}: {
  title?: string;
  bufferInfo?: BufferInfo | null;
}) => {
  return (
    <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]} pointerEvents="none">
      <ActivityIndicator size="large" color="#fff" />
      {bufferInfo ? (
        <>
          <Text style={styles.loadingTitle}>{`缓冲中 ${Math.round(bufferInfo.percent)}%`}</Text>
          {bufferInfo.rate > 0 && (
            <Text style={styles.loadingSubtitle}>
              {formatBitrate(bufferInfo.rate * 8, { unit: 'bytes' })}
            </Text>
          )}
        </>
      ) : title ? (
        <Text style={styles.loadingTitle}>{title}</Text>
      ) : null}
    </View>
  );
};

export const VideoPlayer = ({ itemId }: { itemId: string }) => {
  const { currentServer, currentApi } = useMediaServers();
  const router = useTracedRouter('player');
  const mediaAdapter = useMediaAdapter();
  const { settings } = useDanmakuSettings();

  const [mediaInfo, setMediaInfo] = useState<{
    duration: number;
    currentTime: number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [initialTime, setInitialTime] = useState<number>(-1);
  const [rate, setRate] = useState(1);
  const prevRateRef = useRef<number>(1);

  // High-level playback state machine from mpv (idle/loading/playing/buffering/paused/ended).
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const playbackStateRef = useRef<PlaybackState>('idle');
  // HDR/Dolby Vision state for the title-bar badge.
  const [hdrState, setHdrState] = useState<HdrStateChangeEvent | null>(null);
  // Buffered-ahead progress (0-1) for the seek bar; SharedValue avoids re-render per tick.
  const bufferedProgress = useSharedValue(0);
  // Throttled buffering stats shown in the loading overlay while stalled.
  const [bufferInfo, setBufferInfo] = useState<BufferInfo | null>(null);
  const bufferInfoThrottleRef = useRef(0);
  const isBufferingRef = useRef(false);

  // Track management — sourced from mpv's real track list (getTrackList), so the
  // indices we pass to setAudioTrack/setSubtitleTrack are mpv's own sid/aid,
  // not Jellyfin stream indices (which don't match).
  const [mpvTracks, setMpvTracks] = useState<{
    audio: { index: number; name: string; language?: string }[];
    subtitle: { index: number; name: string; language?: string }[];
  }>({ audio: [], subtitle: [] });
  const [currentTrackIds, setCurrentTrackIds] = useState({ vid: 0, aid: 0, sid: 0 });
  const [aspectRatio, setAspectRatio] = useState<string>('fit');

  // Playback settings only change on a settings round-trip (which remounts this
  // screen), so read them once instead of on every render of the player.
  const { enableTranscoding, enableSubtitleBurnIn, maxBitrate, selectedCodec } = useMemo(
    () => ({
      enableTranscoding: storage.getBoolean('enableTranscoding') ?? false,
      enableSubtitleBurnIn: storage.getBoolean('enableSubtitleBurnIn') ?? false,
      maxBitrate: storage.getNumber('maxBitrate') ?? 0,
      selectedCodec: storage.getString('selectedCodec') ?? 'h264',
    }),
    [],
  );

  const [danmakuEpisodeInfo, setDanmakuEpisodeInfo] = useState<
    { animeTitle: string; episodeTitle: string } | undefined
  >(undefined);

  const player = useRef<ExpoMpvViewRef>(null);
  const isMountedRef = useRef(true);
  const activePlaybackContextRef = useRef<object | null>(null);
  const isPlayerReadyRef = useRef(false);
  const loadedSourceRef = useRef<string | null>(null);
  const hasInitialSeeked = useRef(false);
  const danmakuLayer = useRef<DanmakuLayerRef>(null);
  const currentTime = useSharedValue(0);
  const sourceResumeTimeMsRef = useRef(0);
  const [isNativeSeeking, setIsNativeSeeking] = useState(false);
  const playbackSeekGateRef = useRef(createPlaybackSeekGateState());
  const playbackSeekWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPlaybackSeekWatchdog = useCallback(() => {
    if (!playbackSeekWatchdogRef.current) return;
    clearTimeout(playbackSeekWatchdogRef.current);
    playbackSeekWatchdogRef.current = null;
  }, []);

  const [manualComments, setManualComments] = useState<DandanComment[]>([]);
  const [useManualComments, setUseManualComments] = useState(false);

  const streamInfoKeyOptions = useMemo(
    () => ({
      enableTranscoding,
      maxBitrate,
      enableSubtitleBurnIn,
      selectedCodec,
    }),
    [enableTranscoding, maxBitrate, enableSubtitleBurnIn, selectedCodec],
  );

  const streamDeviceProfile = useMemo(
    () =>
      enableTranscoding
        ? generateDeviceProfile({
            transcode: enableTranscoding,
            maxBitrate: maxBitrate,
            subtitleBurnIn: enableSubtitleBurnIn,
            codec: selectedCodec,
          })
        : generateDeviceProfile(),
    [enableTranscoding, maxBitrate, enableSubtitleBurnIn, selectedCodec],
  );

  const streamDeviceId = useMemo(() => getDeviceId(), []);

  const { itemDetail, autoCommentsData, streamInfo, episodes } = usePlayerQueries({
    itemId,
    mediaAdapter,
    currentServer,
    useManualComments,
    streamInfoKeyOptions,
    streamDeviceProfile,
    streamDeviceId,
  });

  const playbackSourceUrl = streamInfo?.url ?? null;
  const playbackContext = useMemo(
    () => ({ itemId, sourceUrl: playbackSourceUrl }),
    [itemId, playbackSourceUrl],
  );

  useLayoutEffect(() => {
    activePlaybackContextRef.current = playbackContext;
    return () => {
      if (activePlaybackContextRef.current === playbackContext) {
        activePlaybackContextRef.current = null;
      }
    };
  }, [playbackContext]);

  const isPlaybackContextActive = useCallback(
    (context: object, targetPlayer?: ExpoMpvViewRef) =>
      isMountedRef.current &&
      activePlaybackContextRef.current === context &&
      (!targetPlayer || player.current === targetPlayer),
    [],
  );

  useEffect(() => {
    setDanmakuEpisodeInfo(autoCommentsData?.episodeInfo);
  }, [autoCommentsData?.episodeInfo]);

  const comments = useManualComments ? manualComments : (autoCommentsData?.comments ?? []);

  useEffect(() => {
    bufferedProgress.set(0);
  }, [bufferedProgress, itemId]);

  useEffect(() => {
    isPlayerReadyRef.current = false;
    loadedSourceRef.current = null;
    hasInitialSeeked.current = false;
    currentTime.value = 0;
    sourceResumeTimeMsRef.current = 0;
    clearPlaybackSeekWatchdog();
    playbackSeekGateRef.current = createPlaybackSeekGateState(
      0,
      performance.now(),
      playbackSeekGateRef.current.generation,
    );
    setIsNativeSeeking(false);
    danmakuLayer.current?.cleanup();
    setManualComments([]);
    setUseManualComments(false);
    setDanmakuEpisodeInfo(undefined);
    setInitialTime(-1);
    setIsLoaded(false);
    setIsBuffering(true);
    setIsStopped(false);
    playbackStateRef.current = 'idle';
    setPlaybackState('idle');
  }, [clearPlaybackSeekWatchdog, currentTime, itemId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPlaybackSeekWatchdog();
      const currentGate = playbackSeekGateRef.current;
      playbackSeekGateRef.current = createPlaybackSeekGateState(
        currentGate.confirmedPositionTimeMs,
        performance.now(),
        currentGate.generation,
      );
    };
  }, [clearPlaybackSeekWatchdog]);

  useEffect(() => {
    const sourceResumeTimeMs = currentTime.get();
    sourceResumeTimeMsRef.current = sourceResumeTimeMs;
    clearPlaybackSeekWatchdog();
    playbackSeekGateRef.current = createPlaybackSeekGateState(
      sourceResumeTimeMs,
      performance.now(),
      playbackSeekGateRef.current.generation,
    );
    danmakuLayer.current?.cleanup();
    if (playbackSourceUrl) {
      setIsNativeSeeking(true);
      danmakuLayer.current?.seek(sourceResumeTimeMs);
    } else {
      setIsNativeSeeking(false);
    }
    isPlayerReadyRef.current = false;
    loadedSourceRef.current = null;
    hasInitialSeeked.current = false;
    setIsLoaded(false);
    setIsBuffering(true);
    setIsPlaying(false);
    setIsStopped(false);
    playbackStateRef.current = 'idle';
    setPlaybackState('idle');
    setMpvTracks({ audio: [], subtitle: [] });
    setCurrentTrackIds({ vid: 0, aid: 0, sid: 0 });
    setMediaInfo(null);
    setHdrState(null);
    setBufferInfo(null);
    isBufferingRef.current = false;
  }, [clearPlaybackSeekWatchdog, currentTime, playbackSourceUrl]);

  const handleCommentsLoaded = (
    newComments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => {
    setManualComments(newComments);
    setUseManualComments(true);
    setDanmakuEpisodeInfo(episodeInfo);
  };

  // Pull the real track list from mpv. Track `index` here is mpv's own sid/aid.
  const refreshMpvTracks = useCallback(
    async (
      targetPlayer: ExpoMpvViewRef | null = player.current,
      targetSource: string | null = loadedSourceRef.current,
    ) => {
      if (!targetPlayer || !targetSource) return;

      try {
        const list = await targetPlayer.getTrackList();
        const ids = await targetPlayer.getCurrentTrackIds();

        if (player.current !== targetPlayer || loadedSourceRef.current !== targetSource) {
          return;
        }

        if (list) {
          const toEntry = (t: TrackInfo) => {
            const parts: string[] = [];
            if (t.title) parts.push(t.title);
            if (t.lang) parts.push(`[${t.lang}]`);
            if (t.isExternal) parts.push('(ext)');
            return {
              index: t.id,
              name: parts.length ? parts.join(' ') : `Track ${t.id}`,
              language: t.lang || undefined,
            };
          };
          setMpvTracks({
            audio: list.filter((t) => t.type === 'audio').map(toEntry),
            subtitle: list.filter((t) => t.type === 'sub').map(toEntry),
          });
        }
        if (ids) setCurrentTrackIds(ids);
      } catch (e) {
        console.warn('refreshMpvTracks error:', e);
      }
    },
    [],
  );

  const externalSubtitles = useMemo(() => {
    return deriveExternalSubtitles(
      streamInfo?.mediaSource?.MediaStreams ?? [],
      currentApi?.basePath,
    );
  }, [streamInfo?.mediaSource?.MediaStreams, currentApi?.basePath]);

  const externalAudios = useMemo(() => {
    return deriveExternalAudio(streamInfo?.mediaSource?.MediaStreams ?? [], currentApi?.basePath);
  }, [streamInfo?.mediaSource?.MediaStreams, currentApi?.basePath]);

  const { syncPlaybackProgress, syncPlaybackStart, syncPlaybackStop } = usePlaybackSync({
    currentServer,
    itemDetail: itemDetail ?? null,
    currentTime,
    playSessionId: streamInfo?.sessionId ?? null,
  });

  const showLoading = useMemo(() => {
    return (
      isBuffering ||
      !streamInfo?.url ||
      !isLoaded ||
      playbackState === 'loading' ||
      playbackState === 'buffering'
    );
  }, [isBuffering, streamInfo?.url, isLoaded, playbackState]);

  const danmakuPlaybackState = useMemo<PlaybackState>(() => {
    if (isStopped) return 'ended';
    if (!streamInfo?.url || !isLoaded) return 'loading';
    if (isBuffering) return 'buffering';
    return playbackState;
  }, [isBuffering, isLoaded, isStopped, playbackState, streamInfo?.url]);

  const duration = useMemo(() => {
    return deriveDurationMs(itemDetail, mediaInfo?.duration);
  }, [itemDetail, mediaInfo?.duration]);

  const formattedTitle = useMemo(() => {
    return formatPlayerTitle(itemDetail);
  }, [itemDetail]);

  const { hasPreviousEpisode, hasNextEpisode, previousEpisode, nextEpisode } = useMemo(
    () => deriveEpisodeNavigation(itemId, episodes),
    [itemId, episodes],
  );

  useEffect(() => {
    if (!itemDetail) return;

    const playbackPositionTicks = itemDetail.userData?.playbackPositionTicks ?? 0;
    const startTimeMs = Math.round(ticksToMilliseconds(playbackPositionTicks));
    currentTime.value = startTimeMs;
    if (!isPlayerReadyRef.current) sourceResumeTimeMsRef.current = startTimeMs;
    setInitialTime(ticksToSeconds(playbackPositionTicks));
  }, [itemDetail, currentTime]);

  useEffect(() => {
    (async () => {
      if (isPlaying) {
        await activateKeepAwakeAsync();
      } else {
        await deactivateKeepAwake();
      }
    })();
  }, [isPlaying]);

  // Auto-load Jellyfin external subtitles when player is ready, then refresh the
  // mpv track list so they show up in the picker with their real mpv sid.
  useEffect(() => {
    const targetPlayer = player.current;
    const targetSource = streamInfo?.url ?? null;
    if (
      !isLoaded ||
      !targetPlayer ||
      !targetSource ||
      loadedSourceRef.current !== targetSource ||
      externalSubtitles.length === 0
    ) {
      return;
    }

    let cancelled = false;

    const loadExternalSubtitles = async () => {
      for (let i = 0; i < externalSubtitles.length; i++) {
        if (cancelled) return;
        const sub = externalSubtitles[i];
        try {
          // Show the first external subtitle immediately ('select'); add the rest
          // without stealing selection ('auto') so the user can pick them from
          // the track menu (which is keyed by real mpv sid).
          await targetPlayer.addSubtitle(sub.url, i === 0 ? 'select' : 'auto', sub.name);
        } catch (error) {
          console.error(`Failed to load external subtitle: ${sub.name}`, error);
        }
      }
      if (!cancelled) {
        await refreshMpvTracks(targetPlayer, targetSource);
      }
    };

    void loadExternalSubtitles();
    return () => {
      cancelled = true;
    };
  }, [externalSubtitles, isLoaded, refreshMpvTracks, streamInfo?.url]);

  // Auto-load Jellyfin external audio tracks once the player is ready, then refresh
  // the mpv track list so they appear in the audio picker with their real mpv aid.
  useEffect(() => {
    const targetPlayer = player.current;
    const targetSource = streamInfo?.url ?? null;
    if (
      !isLoaded ||
      !targetPlayer ||
      !targetSource ||
      loadedSourceRef.current !== targetSource ||
      externalAudios.length === 0
    ) {
      return;
    }

    let cancelled = false;

    const loadExternalAudios = async () => {
      for (let i = 0; i < externalAudios.length; i++) {
        if (cancelled) return;
        const audio = externalAudios[i];
        try {
          await targetPlayer.addAudio(audio.url, i === 0 ? 'select' : 'auto', audio.name);
        } catch (error) {
          console.error(`Failed to load external audio: ${audio.name}`, error);
        }
      }
      if (!cancelled) {
        await refreshMpvTracks(targetPlayer, targetSource);
      }
    };

    void loadExternalAudios();
    return () => {
      cancelled = true;
    };
  }, [externalAudios, isLoaded, refreshMpvTracks, streamInfo?.url]);

  const handlePlayPause = useCallback(() => {
    player.current?.togglePlay();
  }, [player]);

  const handleRateChange = useCallback(
    (newRate: number | null, options?: { remember?: boolean }) => {
      if (newRate == null) {
        setRate(prevRateRef.current);
        return;
      }
      if (options?.remember === false) {
        setRate(newRate);
        return;
      }
      prevRateRef.current = newRate;
      setRate(newRate);
    },
    [],
  );

  const applyPlaybackSeekCompletion = useCallback(
    (completion: PlaybackSeekCompletion) => {
      clearPlaybackSeekWatchdog();
      setIsNativeSeeking(false);
      currentTime.set(completion.playbackTimeMs);
      danmakuLayer.current?.completeSeek(completion.playbackTimeMs, completion.cursorTimeMs);
      syncPlaybackProgress(completion.playbackTimeMs, false, { force: true });
    },
    [clearPlaybackSeekWatchdog, currentTime, syncPlaybackProgress],
  );

  const requestNativeSeek = useCallback(
    (playerView: ExpoMpvViewRef, targetTimeMs: number) => {
      const requestContext = activePlaybackContextRef.current;
      if (!requestContext || !isPlaybackContextActive(requestContext, playerView)) return;

      const now = performance.now();
      const requestedState = requestPlaybackSeek(playbackSeekGateRef.current, targetTimeMs, now, {
        isPlaying: playbackStateRef.current === 'playing',
        playbackRate: rate,
      });
      playbackSeekGateRef.current = requestedState;
      const pendingSeek = requestedState.pendingSeek;
      if (!pendingSeek) return;

      clearPlaybackSeekWatchdog();
      setIsNativeSeeking(true);
      currentTime.set(pendingSeek.targetTimeMs);
      danmakuLayer.current?.seek(pendingSeek.targetTimeMs);

      const generation = pendingSeek.generation;
      playbackSeekWatchdogRef.current = setTimeout(() => {
        playbackSeekWatchdogRef.current = null;
        if (!isPlaybackContextActive(requestContext, playerView)) return;
        const recovered = recoverTimedOutPlaybackSeek(
          playbackSeekGateRef.current,
          generation,
          performance.now(),
          { trustResolvedCommand: playbackStateRef.current !== 'playing' },
        );
        playbackSeekGateRef.current = recovered.state;
        if (recovered.completion) applyPlaybackSeekCompletion(recovered.completion);
      }, PLAYBACK_SEEK_WATCHDOG_MS);

      void playerView
        .seekTo(pendingSeek.targetTimeMs / 1000)
        .then(() => {
          if (!isPlaybackContextActive(requestContext, playerView)) return;
          playbackSeekGateRef.current = resolvePlaybackSeekCommand(
            playbackSeekGateRef.current,
            generation,
          );
        })
        .catch(() => {
          if (!isPlaybackContextActive(requestContext, playerView)) return;
          const failed = failPlaybackSeek(
            playbackSeekGateRef.current,
            generation,
            performance.now(),
          );
          playbackSeekGateRef.current = failed.state;
          if (failed.completion) applyPlaybackSeekCompletion(failed.completion);
        });
    },
    [
      applyPlaybackSeekCompletion,
      clearPlaybackSeekWatchdog,
      currentTime,
      isPlaybackContextActive,
      rate,
    ],
  );

  const failPendingNativeSeek = useCallback(() => {
    const pendingSeek = playbackSeekGateRef.current.pendingSeek;
    if (!pendingSeek) return;
    const failed = failPlaybackSeek(
      playbackSeekGateRef.current,
      pendingSeek.generation,
      performance.now(),
    );
    playbackSeekGateRef.current = failed.state;
    if (failed.completion) applyPlaybackSeekCompletion(failed.completion);
  }, [applyPlaybackSeekCompletion]);

  const handleSeek = useCallback(
    (position: number) => {
      const playerView = player.current;
      if (
        !isPlayerReadyRef.current ||
        loadedSourceRef.current !== streamInfo?.url ||
        !playerView ||
        duration <= 0 ||
        !Number.isFinite(position)
      ) {
        return;
      }

      const normalizedPosition = Math.max(0, Math.min(position, 1));
      const targetTimeMs = normalizedPosition * duration; // ms
      requestNativeSeek(playerView, targetTimeMs);
      setIsStopped(false);
    },
    [duration, requestNativeSeek, streamInfo?.url],
  );

  // trackId here is mpv's real aid/sid (from mpvTracks[].index).
  const handleAudioTrackChange = useCallback(
    (trackId: number) => {
      const targetPlayer = player.current;
      const targetSource = loadedSourceRef.current;
      targetPlayer?.setAudioTrack(trackId);
      setCurrentTrackIds((prev) => ({ ...prev, aid: trackId }));
      setTimeout(() => void refreshMpvTracks(targetPlayer, targetSource), 200);
    },
    [refreshMpvTracks],
  );

  const handleSubtitleTrackChange = useCallback(
    (trackId: number) => {
      const targetPlayer = player.current;
      const targetSource = loadedSourceRef.current;
      if (trackId === -1) {
        void targetPlayer?.setPropertyString('sid', 'no');
      } else {
        void targetPlayer?.setSubtitleTrack(trackId);
      }
      setCurrentTrackIds((prev) => ({ ...prev, sid: trackId }));
      setTimeout(() => void refreshMpvTracks(targetPlayer, targetSource), 200);
    },
    [refreshMpvTracks],
  );

  const handleAspectRatioChange = useCallback((mode: string) => {
    setAspectRatio(mode);
    switch (mode) {
      case 'fit':
        player.current?.setPropertyString('panscan', '0');
        player.current?.setPropertyString('video-aspect-override', '-1');
        break;
      case 'fill':
        player.current?.setPropertyString('panscan', '1');
        player.current?.setPropertyString('video-aspect-override', '-1');
        break;
      case '16:9':
        player.current?.setPropertyString('panscan', '0');
        player.current?.setPropertyString('video-aspect-override', '16:9');
        break;
      case '4:3':
        player.current?.setPropertyString('panscan', '0');
        player.current?.setPropertyString('video-aspect-override', '4:3');
        break;
    }
  }, []);

  const goToEpisode = useCallback(
    (episodeId?: string) => {
      if (!episodeId) return;
      router.replace({ pathname: '/player', params: { itemId: episodeId } });
    },
    [router],
  );

  const handlePreviousEpisode = useCallback(
    () => goToEpisode(previousEpisode?.id),
    [goToEpisode, previousEpisode],
  );

  const handleNextEpisode = useCallback(
    () => goToEpisode(nextEpisode?.id),
    [goToEpisode, nextEpisode],
  );

  const handleEpisodeSelect = goToEpisode;

  return (
    <View style={styles.container}>
      {playbackSourceUrl && initialTime >= 0 ? (
        <ExpoMpvView
          key={`${itemId}:${playbackSourceUrl}`}
          ref={player}
          style={styles.video}
          source={playbackSourceUrl}
          speed={rate}
          onPlaybackStateChange={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            playbackStateRef.current = nativeEvent.state;
            setPlaybackState(nativeEvent.state);
            setIsPlaying(nativeEvent.isPlaying);
            if (nativeEvent.state === 'playing' || nativeEvent.state === 'paused') {
              setIsStopped(false);
            }
            if (!nativeEvent.isPlaying && !playbackSeekGateRef.current.pendingSeek) {
              syncPlaybackProgress(currentTime.value, true, { force: true });
            }
          }}
          onProgress={({ nativeEvent }) => {
            if (
              !isPlaybackContextActive(playbackContext) ||
              loadedSourceRef.current !== playbackSourceUrl
            ) {
              return;
            }
            const positionMs = nativeEvent.position * 1000;
            const decision = evaluatePlaybackProgress({
              isPlaying: playbackStateRef.current === 'playing',
              playbackRate: rate,
              positionTimeMs: positionMs,
              state: playbackSeekGateRef.current,
              wallTimeMs: performance.now(),
            });
            playbackSeekGateRef.current = decision.state;
            if (decision.accepted) {
              if (decision.completion) {
                applyPlaybackSeekCompletion(decision.completion);
              } else {
                danmakuLayer.current?.syncPlaybackTime(positionMs);
                currentTime.set(positionMs);
                syncPlaybackProgress(positionMs, false);
              }
            }
            bufferedProgress.set(
              deriveBufferedProgress({
                positionSeconds: nativeEvent.position,
                durationSeconds: nativeEvent.duration,
                bufferedDurationSeconds: nativeEvent.bufferedDuration,
                bufferedPositionSeconds: nativeEvent.bufferedPosition,
              }),
            );
            // Surface buffering stats (throttled) only while stalled for cache.
            if (nativeEvent.bufferingPercent < 100) {
              isBufferingRef.current = true;
              const ts = Date.now();
              if (ts - bufferInfoThrottleRef.current >= 500) {
                bufferInfoThrottleRef.current = ts;
                setBufferInfo({
                  percent: nativeEvent.bufferingPercent,
                  rate: nativeEvent.bufferRate,
                });
              }
            } else if (isBufferingRef.current) {
              isBufferingRef.current = false;
              setBufferInfo(null);
            }
          }}
          onSeek={() => {
            if (
              !isPlaybackContextActive(playbackContext) ||
              loadedSourceRef.current !== playbackSourceUrl
            ) {
              return;
            }
            playbackSeekGateRef.current = acknowledgePlaybackSeek(playbackSeekGateRef.current);
          }}
          onHdrStateChange={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            setHdrState(nativeEvent);
          }}
          onLoad={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            isPlayerReadyRef.current = true;
            loadedSourceRef.current = playbackSourceUrl;
            // mpv can report `isPlaying` while it is still opening the source.
            // Resume only after file-loaded, when seek commands are accepted.
            if (!hasInitialSeeked.current) {
              const fallbackDurationSeconds = duration > 0 ? duration / 1000 : 0;
              const loadedDurationSeconds =
                nativeEvent.duration > 0 ? nativeEvent.duration : fallbackDurationSeconds;
              const requestedResumeSeconds = sourceResumeTimeMsRef.current / 1000;
              const resumePositionSeconds =
                loadedDurationSeconds > 0
                  ? Math.min(Math.max(0, requestedResumeSeconds), loadedDurationSeconds)
                  : Math.max(0, requestedResumeSeconds);
              const playerView = player.current;
              if (playerView && resumePositionSeconds > 0.05) {
                requestNativeSeek(playerView, resumePositionSeconds * 1000);
              } else {
                setIsNativeSeeking(false);
              }
              hasInitialSeeked.current = true;
            }
            setIsLoaded(true);
            setIsBuffering(false);
            setIsPlaying(true);
            setIsStopped(false);
            setMediaInfo({
              duration: nativeEvent.duration,
              currentTime: currentTime.value / 1000,
            });
            syncPlaybackStart(currentTime.value);
            // Populate the track picker from mpv's real track list.
            const targetPlayer = player.current;
            const targetSource = playbackSourceUrl;
            setTimeout(() => void refreshMpvTracks(targetPlayer, targetSource), 300);
          }}
          onBuffer={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            setIsBuffering(nativeEvent.isBuffering);
          }}
          onError={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            failPendingNativeSeek();
            isPlayerReadyRef.current = false;
            loadedSourceRef.current = null;
            setIsBuffering(false);
            setIsPlaying(false);
            setIsStopped(true);
            syncPlaybackProgress(currentTime.value, true, { force: true });
            syncPlaybackStop(currentTime.value);
            Alert.alert('Error', nativeEvent.error);
          }}
          onEnd={() => {
            if (!isPlaybackContextActive(playbackContext)) return;
            setIsPlaying(false);
            setIsStopped(true);
            syncPlaybackProgress(currentTime.value, true, { force: true });
            syncPlaybackStop(currentTime.value);
          }}
        />
      ) : null}

      {showLoading && <LoadingIndicator bufferInfo={bufferInfo} />}

      {settings.enabled && comments.length > 0 && initialTime >= 0 ? (
        <DanmakuLayer
          ref={danmakuLayer}
          currentTime={currentTime}
          isSeeking={isNativeSeeking}
          playbackState={danmakuPlaybackState}
          comments={comments}
          playbackRate={rate}
          {...settings}
        />
      ) : null}

      <Controls
        isPlaying={isPlaying}
        isLoading={showLoading}
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
        title={formattedTitle}
        onPlayPause={handlePlayPause}
        onRateChange={handleRateChange}
        rate={rate}
        tracks={mpvTracks}
        selectedTracks={{
          audio: mpvTracks.audio.find((t) => t.index === currentTrackIds.aid),
          subtitle: mpvTracks.subtitle.find((t) => t.index === currentTrackIds.sid),
        }}
        onAudioTrackChange={handleAudioTrackChange}
        onSubtitleTrackChange={handleSubtitleTrackChange}
        aspectRatio={aspectRatio}
        onAspectRatioChange={handleAspectRatioChange}
        hasPreviousEpisode={hasPreviousEpisode}
        hasNextEpisode={hasNextEpisode}
        onPreviousEpisode={handlePreviousEpisode}
        onNextEpisode={handleNextEpisode}
        mediaStats={null}
        bufferedProgress={bufferedProgress}
        hdrState={hdrState}
        onCommentsLoaded={handleCommentsLoaded}
        danmakuEpisodeInfo={danmakuEpisodeInfo}
        danmakuComments={comments}
        episodes={episodes}
        currentItem={itemDetail}
        onEpisodeSelect={handleEpisodeSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    height: '100%',
    width: '100%',
  },
  video: {
    height: '100%',
    width: '100%',
  },
  bufferingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
});
