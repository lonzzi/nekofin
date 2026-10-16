// @refresh reset

import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { readPlaybackPreferences } from '@/hooks/usePlaybackPreferences';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { preferredTrackId } from '@/lib/playbackPreferences';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import { formatBitrate, getDeviceId, ticksToMilliseconds, ticksToSeconds } from '@/lib/utils';
import { resolveDanmakuSelection, type DanmakuCommentsData } from '@/services/danmaku';
import { danmakuSourcesKey } from '@/services/danmakuSources';
import type { PlaybackSelection } from '@/services/media/playbackSelection';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  ExpoMpvView,
  type ExpoMpvViewRef,
  type HdrStateChangeEvent,
  type PlaybackState,
  type TrackInfo,
} from 'expo-mpv';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useMMKVBoolean } from 'react-native-mmkv';
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
import { createPlayerAutoNext, type PlaybackCompletion } from './playerAutoNext';
import {
  deriveBufferedProgress,
  deriveDurationMs,
  deriveEpisodeNavigation,
  deriveExternalAudio,
  deriveExternalSubtitles,
  deriveTracks,
  formatPlayerTitle,
} from './playerDerived';
import { PlayerEntryVisibilityContext } from './PlayerEntryContext';
import { createPlayerLoadRecovery, playbackFailureMessage } from './playerLoadRecovery';
import { isExternalTrackCommandError, loadExternalPlayerTrack } from './playerTrackLoading';
import { usePlayerQueries } from './usePlayerQueries';

type BufferInfo = { percent: number; rate: number };

function toMpvTrackEntry(track: TrackInfo) {
  const parts = [
    track.title,
    track.lang ? `[${track.lang}]` : '',
    track.isExternal ? '(ext)' : '',
  ].filter(Boolean);
  return {
    index: track.id,
    name: parts.join(' ') || `Track ${track.id}`,
    language: track.lang || undefined,
  };
}

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

export const VideoPlayer = ({
  itemId,
  initialSelection,
}: {
  itemId: string;
  initialSelection?: PlaybackSelection;
}) => {
  const { currentServer, currentApi } = useMediaServers();
  const entryControlsVisible = useContext(PlayerEntryVisibilityContext);
  const router = useTracedRouter('player');
  const mediaAdapter = useMediaAdapter();
  const { settings } = useDanmakuSettings();
  const { sourceSettings, sources } = useDanmakuSources();
  const sourceKey = danmakuSourcesKey(sources);

  const [mediaInfo, setMediaInfo] = useState<{
    duration: number;
    currentTime: number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [initialTime, setInitialTime] = useState<number>(-1);
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [rate, setRate] = useState(() => storage.getNumber('playback.defaultRate') ?? 1);
  const prevRateRef = useRef<number>(rate);

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
  const manualTrackChoice = useRef({ audio: false, subtitle: false });
  const rememberedTrackChoice = useRef<{
    audio?: { name: string; language?: string };
    subtitle?: { name: string; language?: string } | 'off';
  }>({});
  const resumePausedRef = useRef(false);
  const externalTrackLoads = useRef<{
    player: ExpoMpvViewRef;
    source: string;
    requests: Map<string, Promise<number | undefined>>;
    subtitleIds: Map<number, number>;
    audioIds: Map<number, number>;
  } | null>(null);
  const [versionChoice, setVersionChoice] = useState<{ itemId: string; id: string } | null>(null);
  const selectedMediaSourceId =
    versionChoice?.itemId === itemId ? versionChoice.id : initialSelection?.mediaSourceId;
  const [serverTrackChoice, setServerTrackChoice] = useState<{
    itemId: string;
    sourceId: string;
    audio?: number;
    subtitle?: number;
  } | null>(null);
  const activeServerTrackChoice = useMemo(
    () =>
      serverTrackChoice?.itemId === itemId && serverTrackChoice.sourceId === selectedMediaSourceId
        ? serverTrackChoice
        : selectedMediaSourceId === initialSelection?.mediaSourceId
          ? {
              audio: initialSelection?.audioStreamIndex,
              subtitle: initialSelection?.subtitleStreamIndex,
            }
          : null,
    [serverTrackChoice, itemId, selectedMediaSourceId, initialSelection],
  );
  const [aspectRatio, setAspectRatio] = useState<string>('fit');
  const [preferences] = useState(readPlaybackPreferences);
  const [autoPlayNext = true] = useMMKVBoolean('playback.autoPlayNext', storage);
  const [playbackCompletion, setPlaybackCompletion] = useState<PlaybackCompletion | null>(null);
  const [autoNext] = useState(createPlayerAutoNext);

  // Playback settings only change on a settings round-trip (which remounts this
  // screen), so read them once instead of on every render of the player.
  const { enableTranscoding, enableSubtitleBurnIn, maxBitrate, selectedCodec } = useMemo(
    () => ({
      enableTranscoding: storage.getBoolean('enableTranscoding') ?? false,
      enableSubtitleBurnIn: storage.getBoolean('enableSubtitleBurnIn') ?? false,
      maxBitrate: storage.getNumber('maxBitrate') ?? 20000000,
      selectedCodec: storage.getString('selectedCodec') ?? 'h264',
    }),
    [],
  );

  const player = useRef<ExpoMpvViewRef>(null);
  const isMountedRef = useRef(true);
  const activePlaybackContextRef = useRef<object | null>(null);
  const completedPlaybackContextRef = useRef<object | null>(null);
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

  const [manualDanmaku, setManualDanmaku] = useState<DanmakuCommentsData>();
  const [danmakuSelectionOverride, setDanmakuSelectionOverride] = useState<string | null>(null);
  const useManualComments = manualDanmaku !== undefined;

  const streamInfoKeyOptions = useMemo(
    () => ({
      enableTranscoding,
      maxBitrate,
      enableSubtitleBurnIn,
      selectedCodec,
      mediaSourceId: selectedMediaSourceId,
      audioStreamIndex: activeServerTrackChoice?.audio,
      subtitleStreamIndex:
        activeServerTrackChoice?.subtitle ?? (preferences.subtitlesEnabled ? undefined : -1),
    }),
    [
      enableTranscoding,
      maxBitrate,
      enableSubtitleBurnIn,
      selectedCodec,
      selectedMediaSourceId,
      activeServerTrackChoice,
      preferences.subtitlesEnabled,
    ],
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

  const loadRecovery = useMemo(() => createPlayerLoadRecovery(), []);
  const loadSelectionKey = JSON.stringify([currentServer?.id, itemId, streamInfoKeyOptions]);

  useEffect(() => setLoadFailure(null), [loadSelectionKey]);

  const {
    itemDetail,
    autoCommentsData,
    streamInfo,
    streamInfoError,
    playbackSelection,
    episodes,
    mediaSources,
  } = usePlayerQueries({
    itemId,
    mediaAdapter,
    currentServer,
    useManualComments,
    streamInfoKeyOptions,
    streamDeviceProfile,
    streamDeviceId,
    playbackAttempt,
    preferences,
  });

  const playbackSourceUrl = streamInfo?.url ?? null;
  const usesServerTracks = !!streamInfo?.mediaSource?.TranscodingUrl;
  const menuTracks = usesServerTracks
    ? deriveTracks(streamInfo?.mediaSource?.MediaStreams ?? [])
    : mpvTracks;

  const changeServerTrack = useCallback(
    (type: 'audio' | 'subtitle', index: number) => {
      const sourceId = streamInfo?.mediaSource?.Id;
      if (!sourceId) return;
      resumePausedRef.current = !isPlaying;
      setVersionChoice({ itemId, id: sourceId });
      setServerTrackChoice((previous) => ({
        itemId,
        sourceId,
        audio:
          previous?.itemId === itemId && previous.sourceId === sourceId
            ? previous.audio
            : (streamInfo?.mediaSource?.DefaultAudioStreamIndex ?? undefined),
        subtitle:
          previous?.itemId === itemId && previous.sourceId === sourceId
            ? previous.subtitle
            : (streamInfo?.mediaSource?.DefaultSubtitleStreamIndex ?? undefined),
        [type]: index,
      }));
    },
    [itemId, streamInfo?.mediaSource, isPlaying],
  );

  const playbackContext = useMemo(
    () => ({ itemId, sourceUrl: playbackSourceUrl, playbackAttempt }),
    [itemId, playbackSourceUrl, playbackAttempt],
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

  const danmakuData = manualDanmaku ?? autoCommentsData;
  const requestedSelection = danmakuSelectionOverride ?? sourceSettings.mode;
  const danmakuSelection =
    requestedSelection === 'auto' ||
    requestedSelection === 'merge' ||
    danmakuData?.tracks?.some((track) => track.id === requestedSelection)
      ? requestedSelection
      : 'auto';
  const resolvedDanmaku = useMemo(
    () => resolveDanmakuSelection(danmakuData, danmakuSelection),
    [danmakuData, danmakuSelection],
  );
  const comments = resolvedDanmaku.comments;
  const danmakuEpisodeInfo = resolvedDanmaku.episodeInfo;
  useEffect(() => {
    setManualDanmaku(undefined);
    setDanmakuSelectionOverride(null);
  }, [sourceKey]);

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
    setManualDanmaku(undefined);
    setDanmakuSelectionOverride(null);
    setInitialTime(-1);
    rememberedTrackChoice.current = {};
    resumePausedRef.current = false;
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
    manualTrackChoice.current = { audio: false, subtitle: false };
    setMpvTracks({ audio: [], subtitle: [] });
    setCurrentTrackIds({ vid: 0, aid: 0, sid: 0 });
    setMediaInfo(null);
    setHdrState(null);
    setBufferInfo(null);
    isBufferingRef.current = false;
  }, [clearPlaybackSeekWatchdog, currentTime, playbackSourceUrl, playbackAttempt]);

  const handleCommentsLoaded = (data: DanmakuCommentsData) => {
    setManualDanmaku(data);
    setDanmakuSelectionOverride((data.tracks?.length ?? 0) > 1 ? 'merge' : 'auto');
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
          setMpvTracks({
            audio: list.filter((t) => t.type === 'audio').map(toMpvTrackEntry),
            subtitle: list.filter((t) => t.type === 'sub').map(toMpvTrackEntry),
          });
        }
        if (list && ids) {
          const { audioLanguage, subtitleLanguage, subtitlesEnabled } = preferences;
          const source = streamInfo?.mediaSource;
          const rememberedId = (type: 'audio' | 'subtitle') => {
            const choice = rememberedTrackChoice.current[type];
            if (choice === 'off') return -1;
            if (!choice) return undefined;
            const nativeType = type === 'audio' ? 'audio' : 'sub';
            return (
              list.find(
                (entry) => entry.type === nativeType && toMpvTrackEntry(entry).name === choice.name,
              )?.id ??
              (choice.language
                ? preferredTrackId(
                    list.filter((entry) => entry.type === nativeType),
                    choice.language,
                  )
                : undefined)
            );
          };
          const serverTrackId = (type: 'Audio' | 'Subtitle', index: number | null | undefined) => {
            if (index == null) return undefined;
            if (index === -1) return -1;
            const externalIds =
              type === 'Audio'
                ? externalTrackLoads.current?.audioIds
                : externalTrackLoads.current?.subtitleIds;
            const externalId = externalIds?.get(index);
            if (externalId != null) return externalId;
            // A transcoded stream has its own stream order; only original-file
            // playback can map embedded server indices by position within type.
            if (source?.TranscodingUrl) return undefined;
            const embedded =
              source?.MediaStreams?.filter((entry) => entry.Type === type && !entry.IsExternal) ??
              [];
            const position = embedded.findIndex((entry) => entry.Index === index);
            return list.filter(
              (entry) => entry.type === (type === 'Audio' ? 'audio' : 'sub') && !entry.isExternal,
            )[position]?.id;
          };
          const audio =
            rememberedId('audio') ??
            serverTrackId('Audio', playbackSelection.audioStreamIndex) ??
            (source?.TranscodingUrl
              ? undefined
              : preferredTrackId(
                  list.filter((t) => t.type === 'audio'),
                  audioLanguage,
                )) ??
            serverTrackId('Audio', source?.DefaultAudioStreamIndex);
          const subtitle =
            rememberedId('subtitle') ??
            serverTrackId('Subtitle', playbackSelection.subtitleStreamIndex) ??
            (!subtitlesEnabled
              ? -1
              : ((source?.TranscodingUrl
                  ? undefined
                  : preferredTrackId(
                      list.filter((t) => t.type === 'sub'),
                      subtitleLanguage,
                    )) ?? serverTrackId('Subtitle', source?.DefaultSubtitleStreamIndex)));
          if (!manualTrackChoice.current.audio && audio != null && audio !== ids.aid) {
            await targetPlayer.setAudioTrack(audio);
            if (player.current !== targetPlayer || loadedSourceRef.current !== targetSource) return;
            ids.aid = audio;
          }
          if (!manualTrackChoice.current.subtitle && subtitle != null && subtitle !== ids.sid) {
            if (subtitle === -1) await targetPlayer.setPropertyString('sid', 'no');
            else await targetPlayer.setSubtitleTrack(subtitle);
            ids.sid = subtitle;
          }
        }
        const confirmedIds = await targetPlayer.getCurrentTrackIds();
        if (player.current === targetPlayer && loadedSourceRef.current === targetSource)
          setCurrentTrackIds(confirmedIds);
      } catch (e) {
        console.warn('refreshMpvTracks error:', e);
      }
    },
    [streamInfo, playbackSelection, preferences],
  );

  const externalSubtitles = useMemo(() => {
    return deriveExternalSubtitles(
      streamInfo?.mediaSource?.MediaStreams ?? [],
      currentApi?.basePath,
      { itemId, mediaSourceId: streamInfo?.mediaSource?.Id, accessToken: currentApi?.accessToken },
    );
  }, [itemId, streamInfo?.mediaSource, currentApi?.basePath, currentApi?.accessToken]);

  const externalAudios = useMemo(() => {
    return deriveExternalAudio(streamInfo?.mediaSource?.MediaStreams ?? [], currentApi?.basePath, {
      accessToken: currentApi?.accessToken,
    });
  }, [streamInfo?.mediaSource?.MediaStreams, currentApi?.basePath, currentApi?.accessToken]);

  const { syncPlaybackProgress, syncPlaybackStart, syncPlaybackStop } = usePlaybackSync({
    currentServer,
    itemDetail: itemDetail ?? null,
    currentTime,
    playSessionId: streamInfo?.sessionId ?? null,
    mediaSourceId: streamInfo?.mediaSource?.Id ?? undefined,
  });

  const retryPlayback = useCallback(() => {
    if (!isMountedRef.current) return;
    // Invalidate the old view immediately: mpv sends END_FILE after onError,
    // and that late event must not stop or report the replacement playback.
    activePlaybackContextRef.current = null;
    resumePausedRef.current ||= playbackStateRef.current === 'paused';
    setLoadFailure(null);
    setPlaybackAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    if (!loadFailure) return;
    Alert.alert('播放失败', loadFailure, [
      { text: '返回', style: 'cancel', onPress: () => router.back() },
      { text: '重新加载', onPress: retryPlayback },
    ]);
  }, [loadFailure, retryPlayback, router]);

  useEffect(() => {
    if (streamInfoError) {
      setLoadFailure('无法获取播放信息。请检查服务器连接后重新加载。');
    }
  }, [streamInfoError]);

  const showLoading = useMemo(() => {
    return (
      !loadFailure &&
      (isBuffering ||
        !streamInfo?.url ||
        !isLoaded ||
        playbackState === 'loading' ||
        playbackState === 'buffering')
    );
  }, [loadFailure, isBuffering, streamInfo?.url, isLoaded, playbackState]);

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

  // Serialize external loads and cache their in-flight requests per native player.
  // React effect restarts must not add the same subtitle twice or steal selection.
  useEffect(() => {
    const targetPlayer = player.current;
    const targetSource = streamInfo?.url ?? null;
    if (!isLoaded || !targetPlayer || !targetSource || loadedSourceRef.current !== targetSource)
      return;

    if (
      externalTrackLoads.current?.player !== targetPlayer ||
      externalTrackLoads.current.source !== targetSource
    ) {
      externalTrackLoads.current = {
        player: targetPlayer,
        source: targetSource,
        requests: new Map(),
        subtitleIds: new Map(),
        audioIds: new Map(),
      };
    }
    const loads = externalTrackLoads.current;
    const isActive = () =>
      isMountedRef.current &&
      player.current === targetPlayer &&
      loadedSourceRef.current === targetSource;
    let cancelled = false;
    const loadTracks = async () => {
      const pending = [
        ...externalSubtitles.map((track) => ({
          track,
          type: 'sub' as const,
          ids: loads.subtitleIds,
        })),
        ...externalAudios.map((track) => ({ track, type: 'audio' as const, ids: loads.audioIds })),
      ];
      let failed = false;
      for (const { track, type, ids } of pending) {
        if (cancelled || !isActive()) return;
        const key = `${type}:${track.index}:${track.url}`;
        let request = loads.requests.get(key);
        if (!request) {
          request = loadExternalPlayerTrack(targetPlayer, type, track, isActive);
          loads.requests.set(key, request);
        }
        try {
          const id = await request;
          if (id != null) ids.set(track.index, id);
        } catch {
          failed = true;
        }
      }
      if (!cancelled && isActive()) {
        await refreshMpvTracks(targetPlayer, targetSource);
        if (failed)
          Alert.alert(
            '部分轨道加载失败',
            '部分外挂字幕或音轨未能加载，请检查服务器连接后重新播放。',
          );
      }
    };
    void loadTracks();
    return () => {
      cancelled = true;
    };
  }, [externalSubtitles, externalAudios, isLoaded, refreshMpvTracks, streamInfo?.url]);

  const handlePlayPause = useCallback(() => {
    if (loadFailure) {
      retryPlayback();
      return;
    }
    player.current?.togglePlay();
  }, [loadFailure, retryPlayback]);

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
      if (resumePausedRef.current) {
        // HLS must decode the resumed frame before pausing the replacement view.
        void player.current?.pause();
        resumePausedRef.current = false;
      }
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
    async (trackId: number) => {
      if (usesServerTracks) {
        changeServerTrack('audio', trackId);
        return;
      }
      const targetPlayer = player.current;
      const targetSource = loadedSourceRef.current;
      if (!targetPlayer || !targetSource) return;
      manualTrackChoice.current.audio = true;
      rememberedTrackChoice.current.audio = mpvTracks.audio.find(
        (track) => track.index === trackId,
      );
      try {
        await targetPlayer.setAudioTrack(trackId);
        await refreshMpvTracks(targetPlayer, targetSource);
      } catch {
        if (player.current === targetPlayer) Alert.alert('音轨切换失败', '请重新选择音轨。');
      }
    },
    [refreshMpvTracks, usesServerTracks, changeServerTrack, mpvTracks],
  );

  const handleSubtitleTrackChange = useCallback(
    async (trackId: number) => {
      if (usesServerTracks) {
        changeServerTrack('subtitle', trackId);
        return;
      }
      const targetPlayer = player.current;
      const targetSource = loadedSourceRef.current;
      if (!targetPlayer || !targetSource) return;
      manualTrackChoice.current.subtitle = true;
      rememberedTrackChoice.current.subtitle =
        trackId === -1 ? 'off' : mpvTracks.subtitle.find((track) => track.index === trackId);
      try {
        if (trackId === -1) await targetPlayer.setPropertyString('sid', 'no');
        else await targetPlayer.setSubtitleTrack(trackId);
        await refreshMpvTracks(targetPlayer, targetSource);
      } catch {
        if (player.current === targetPlayer) Alert.alert('字幕切换失败', '请重新选择字幕。');
      }
    },
    [refreshMpvTracks, usesServerTracks, changeServerTrack, mpvTracks],
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
      if (!episodeId || episodeId === itemId) return;
      activePlaybackContextRef.current = null;
      router.replace({ pathname: '/player', params: { itemId: episodeId } });
    },
    [itemId, router],
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

  const completePlayback = useCallback(
    (context: object) => {
      if (
        !isPlaybackContextActive(context) ||
        !isPlayerReadyRef.current ||
        completedPlaybackContextRef.current === context
      )
        return;
      completedPlaybackContextRef.current = context;
      setPlaybackCompletion({ context, reason: 'ended' });
      setIsPlaying(false);
      setIsStopped(true);
      syncPlaybackProgress(currentTime.value, true, { force: true });
      syncPlaybackStop(currentTime.value);
    },
    [isPlaybackContextActive, currentTime, syncPlaybackProgress, syncPlaybackStop],
  );

  useEffect(() => {
    const nextId = autoNext.claim({
      completion: playbackCompletion,
      activeContext: activePlaybackContextRef.current,
      enabled: autoPlayNext,
      itemId,
      itemType: itemDetail?.type,
      nextEpisodeId: nextEpisode?.id,
    });
    if (nextId) {
      goToEpisode(nextId);
    }
  }, [
    autoNext,
    autoPlayNext,
    playbackCompletion,
    itemId,
    itemDetail?.type,
    nextEpisode?.id,
    goToEpisode,
  ]);

  return (
    <View style={styles.container}>
      {playbackSourceUrl && initialTime >= 0 && !loadFailure ? (
        <ExpoMpvView
          key={`${itemId}:${playbackSourceUrl}:${playbackAttempt}`}
          ref={player}
          style={styles.video}
          source={playbackSourceUrl}
          speed={rate}
          onPlaybackStateChange={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            playbackStateRef.current = nativeEvent.state;
            setPlaybackState(nativeEvent.state);
            setIsPlaying(nativeEvent.state !== 'ended' && nativeEvent.isPlaying);
            if (nativeEvent.state === 'playing' || nativeEvent.state === 'paused') {
              completedPlaybackContextRef.current = null;
              setPlaybackCompletion(null);
              setIsStopped(false);
            }
            // With keep-open enabled, mpv can signal eof-reached without an
            // end-file event. Both native EOF signals share the same completion gate.
            if (nativeEvent.state === 'ended') completePlayback(playbackContext);
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
            setIsPlaying(!resumePausedRef.current);
            if (resumePausedRef.current && !playbackSeekGateRef.current.pendingSeek) {
              void player.current?.pause();
              resumePausedRef.current = false;
            }
            setIsStopped(false);
            setMediaInfo({
              duration: nativeEvent.duration,
              currentTime: currentTime.value / 1000,
            });
            syncPlaybackStart(currentTime.value);
          }}
          onBuffer={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            setIsBuffering(nativeEvent.isBuffering);
          }}
          onError={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            // mpv reports async sub-add/audio-add failures through the same event
            // as video failures. The loader handles missing tracks separately.
            if (isExternalTrackCommandError(nativeEvent.error)) return;
            if (loadRecovery.claimAutomaticRetry(nativeEvent.error, loadSelectionKey)) {
              retryPlayback();
              return;
            }
            failPendingNativeSeek();
            activePlaybackContextRef.current = null;
            isPlayerReadyRef.current = false;
            loadedSourceRef.current = null;
            setIsBuffering(false);
            setIsPlaying(false);
            setIsStopped(true);
            syncPlaybackProgress(currentTime.value, true, { force: true });
            syncPlaybackStop(currentTime.value);
            setLoadFailure(playbackFailureMessage(nativeEvent.error));
          }}
          onEnd={({ nativeEvent }) => {
            if (nativeEvent.reason === 'ended') completePlayback(playbackContext);
          }}
        />
      ) : null}

      {(showLoading || !entryControlsVisible) && (
        <LoadingIndicator
          bufferInfo={bufferInfo}
          title={playbackAttempt > 0 && !isLoaded ? '正在重新加载视频…' : undefined}
        />
      )}

      {entryControlsVisible && settings.enabled && comments.length > 0 && initialTime >= 0 ? (
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

      {entryControlsVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
            tracks={menuTracks}
            selectedTracks={{
              audio: menuTracks.audio.find(
                (t) =>
                  t.index ===
                  (usesServerTracks
                    ? (activeServerTrackChoice?.audio ??
                      streamInfo?.mediaSource?.DefaultAudioStreamIndex)
                    : currentTrackIds.aid),
              ),
              subtitle: menuTracks.subtitle.find(
                (t) =>
                  t.index ===
                  (usesServerTracks
                    ? (activeServerTrackChoice?.subtitle ??
                      streamInfo?.mediaSource?.DefaultSubtitleStreamIndex)
                    : currentTrackIds.sid),
              ),
            }}
            onAudioTrackChange={handleAudioTrackChange}
            onSubtitleTrackChange={handleSubtitleTrackChange}
            mediaSources={mediaSources}
            selectedMediaSourceId={streamInfo?.mediaSource?.Id ?? selectedMediaSourceId}
            onMediaSourceChange={(id) => {
              if (id === streamInfo?.mediaSource?.Id) return;
              resumePausedRef.current = !isPlaying;
              setVersionChoice({ itemId, id });
            }}
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
            danmakuTracks={resolvedDanmaku.tracks}
            danmakuSelection={danmakuSelection}
            onDanmakuSelectionChange={setDanmakuSelectionOverride}
            danmakuFailedSources={resolvedDanmaku.failedSources}
            episodes={episodes}
            currentItem={itemDetail}
            onEpisodeSelect={handleEpisodeSelect}
          />
        </View>
      )}
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
    ...StyleSheet.absoluteFill,
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
