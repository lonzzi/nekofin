// @refresh reset

import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { readPlaybackPreferences } from '@/hooks/usePlaybackPreferences';
import { useSubtitleFonts } from '@/hooks/useSubtitleFonts';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { t as tr, useTranslation } from '@/lib/i18n';
import { preferredTrackId } from '@/lib/playbackPreferences';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { formatBitrate, getDeviceId, ticksToMilliseconds, ticksToSeconds } from '@/lib/utils';
import { resolveDanmakuSelection, type DanmakuCommentsData } from '@/services/danmaku';
import { danmakuSourcesKey } from '@/services/danmakuSources';
import { subtitleTracksToLoad } from '@/services/media/externalTracks';
import { mapMediaSource } from '@/services/media/mappers';
import { applyPlaybackQuality, type PlaybackQuality } from '@/services/media/playbackQuality';
import {
  resolvePlaybackSelection,
  type PlaybackSelection,
} from '@/services/media/playbackSelection';
import { resolveMediaSegments } from '@/services/media/segments';
import { BUNDLED_SUBTITLE_FONT_DIRECTORY } from '@/services/media/subtitleFonts';
import { Directory, Paths } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  ExpoMpvView,
  type ExpoMpvViewRef,
  type HdrStateChangeEvent,
  type PlaybackState,
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
import { ActivityIndicator, Alert, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';
import { useSharedValue } from 'react-native-reanimated';

import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { Controls } from './Controls';
import { DanmakuLayer, DanmakuLayerRef } from './DanmakuLayer';
import { createExternalSubtitleCache } from './externalSubtitleCache';
import { parsePlaybackDecodingMode, playbackHwdec } from './playbackDecoding';
import { derivePlaybackSourceInfo } from './playbackInfo';
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
import { canSeekPlayback } from './playerControlModel';
import {
  deriveBufferedProgress,
  deriveDurationMs,
  deriveEpisodeNavigation,
  deriveExternalAudio,
  deriveExternalSubtitles,
  deriveMpvTracks,
  deriveStartPositionSeconds,
  deriveTracks,
  formatPlayerTitle,
} from './playerDerived';
import { PlayerEntryVisibilityContext, PlayerExitPreparationContext } from './PlayerEntryContext';
import { createPlayerLoadRecovery, playbackFailureMessage } from './playerLoadRecovery';
import { serverIndexForNativeTrack } from './playerQualitySelection';
import { createPlayerSegmentSkip } from './playerSegmentSkip';
import {
  deriveNativeSubtitleState,
  deriveSubtitleMenuTracks,
  requiresServerSubtitleSwitch,
  resolveSubtitleMenuSelection,
  shouldReloadSubtitleStream,
  subtitleChoiceForSource,
  type SubtitleChoice,
} from './playerSubtitleMenu';
import {
  createExternalTrackRequestCache,
  externalTrackRequestKey,
  isExternalTrackCommandError,
  loadExternalPlayerTrack,
  loadExternalTracksProgressively,
  selectPlayerSubtitleTrack,
} from './playerTrackLoading';
import { createSubtitleFontController } from './subtitleFontSettings';
import { usePlaybackDiagnostics } from './usePlaybackDiagnostics';
import { usePlayerQueries } from './usePlayerQueries';

type BufferInfo = { percent: number; rate: number };

const LoadingIndicator = ({
  title,
  bufferInfo,
}: {
  title?: string;
  bufferInfo?: BufferInfo | null;
}) => {
  const { t: tr } = useTranslation();
  return (
    <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]} pointerEvents="none">
      <ActivityIndicator size="large" color="#fff" />
      {bufferInfo ? (
        <>
          <Text style={styles.loadingTitle}>
            {tr('player.bufferingProgress', { value: Math.round(bufferInfo.percent) })}
          </Text>
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
  // Translate callback messages live without restarting track effects on locale changes.
  useTranslation();
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
  const [sourceStart, setSourceStart] = useState<{
    context: object;
    positionMs: number;
    paused: boolean;
  } | null>(null);
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

  // Native operations use mpv IDs; subtitle menu rows use server stream indices.
  const [mpvTracks, setMpvTracks] = useState<{
    audio: { index: number; name: string; language?: string }[];
    subtitle: { index: number; name: string; language?: string }[];
  }>({ audio: [], subtitle: [] });
  const [currentTrackIds, setCurrentTrackIds] = useState({ vid: 0, aid: 0, sid: 0 });
  const [subtitleChoice, setSubtitleChoice] = useState<SubtitleChoice | null>(null);
  const subtitleChoiceRef = useRef<SubtitleChoice | null>(null);
  const [failedSubtitleIndices, setFailedSubtitleIndices] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [nativeSubtitleState, setNativeSubtitleState] = useState<{
    sourceUrl: string;
    sourceId: string;
    ids: ReadonlyMap<number, number>;
    selectedIndex?: number;
  } | null>(null);
  const manualTrackChoice = useRef({ audio: false, subtitle: false });
  const rememberedTrackChoice = useRef<{
    audio?: { name: string; language?: string };
    subtitle?: { name: string; language?: string } | 'off';
  }>({});
  const resumePausedRef = useRef(false);
  const externalTrackLoads = useRef<{
    player: ExpoMpvViewRef;
    source: string;
    requests: ReturnType<typeof createExternalTrackRequestCache>;
    subtitleIds: Map<number, number>;
    audioIds: Map<number, number>;
    subtitleCache: ReturnType<typeof createExternalSubtitleCache>;
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
  const [autoSkipIntro = false] = useMMKVBoolean('playback.autoSkipIntro', storage);
  const [autoSkipOutro = false] = useMMKVBoolean('playback.autoSkipOutro', storage);
  const [playbackCompletion, setPlaybackCompletion] = useState<PlaybackCompletion | null>(null);
  const [autoNext] = useState(createPlayerAutoNext);
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Playback settings only change on a settings round-trip (which remounts this
  // screen), so read them once instead of on every render of the player.
  const playbackDefaults = useMemo(
    () => ({
      enableTranscoding: storage.getBoolean('enableTranscoding') ?? false,
      enableSubtitleBurnIn: storage.getBoolean('enableSubtitleBurnIn') ?? false,
      maxBitrate: storage.getNumber('maxBitrate') ?? 20000000,
      selectedCodec: storage.getString('selectedCodec') ?? 'h264',
    }),
    [],
  );
  const [qualityChoice, setQualityChoice] = useState<{
    itemId: string;
    quality: PlaybackQuality;
  } | null>(null);
  const quality =
    qualityChoice?.itemId === itemId
      ? qualityChoice.quality
      : (initialSelection?.quality ?? 'auto');
  const { enableTranscoding, enableSubtitleBurnIn, maxBitrate, selectedCodec } = useMemo(
    () => applyPlaybackQuality(quality, playbackDefaults),
    [quality, playbackDefaults],
  );

  const [storedDecodingMode, setStoredDecodingMode] = useMMKVString(
    'playback.decodingMode',
    storage,
  );
  const decodingMode = parsePlaybackDecodingMode(storedDecodingMode) ?? 'auto';
  const hwdec = Platform.OS === 'web' ? undefined : playbackHwdec(decodingMode, Platform.OS);
  const player = useRef<ExpoMpvViewRef>(null);
  const isExitingRef = useRef(false);
  const exitPreparation = useContext(PlayerExitPreparationContext);
  useLayoutEffect(
    () =>
      exitPreparation?.register(() => {
        isExitingRef.current = true;
        return Platform.OS === 'android'
          ? (player.current?.prepareForExit?.() ?? Promise.resolve())
          : Promise.resolve();
      }),
    [exitPreparation],
  );
  const isMountedRef = useRef(true);
  const activePlaybackContextRef = useRef<object | null>(null);
  const completedPlaybackContextRef = useRef<object | null>(null);
  const isPlayerReadyRef = useRef(false);
  const loadedSourceRef = useRef<string | null>(null);
  const danmakuLayer = useRef<DanmakuLayerRef>(null);
  const currentTime = useSharedValue(0);
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
    mediaSegments: serverSegments,
    segmentsPending,
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
    subtitlePrefetchChoice:
      subtitleChoice?.itemId === itemId &&
      (!selectedMediaSourceId || subtitleChoice.sourceId === selectedMediaSourceId)
        ? subtitleChoice
        : undefined,
  });

  const playbackSourceUrl = streamInfo?.url ?? null;
  const segmentSkip = useMemo(
    () => ({
      serverId: currentServer?.id,
      itemId,
      sourceId: streamInfo?.mediaSource?.Id,
      ...createPlayerSegmentSkip(),
    }),
    [currentServer?.id, itemId, streamInfo?.mediaSource?.Id],
  );
  const usesServerTracks = !!streamInfo?.mediaSource?.TranscodingUrl;
  const subtitleSourceMetadata = streamInfo?.mediaSource;
  const subtitleMenuSource = useMemo(() => {
    if (subtitleSourceMetadata) return mapMediaSource(subtitleSourceMetadata);
    const sourceId = playbackSelection.mediaSourceId ?? selectedMediaSourceId;
    return sourceId ? mediaSources.find((source) => source.id === sourceId) : mediaSources[0];
  }, [
    subtitleSourceMetadata,
    playbackSelection.mediaSourceId,
    selectedMediaSourceId,
    mediaSources,
  ]);
  const hasServerSubtitleMenu = !!subtitleMenuSource?.mediaStreams.some(
    (stream) => stream.type === 'Subtitle',
  );
  const requestedSubtitleIndex = subtitleChoiceForSource(
    subtitleChoice,
    itemId,
    subtitleMenuSource?.id,
  );
  const activeNativeSubtitles =
    nativeSubtitleState?.sourceUrl === playbackSourceUrl &&
    nativeSubtitleState.sourceId === subtitleMenuSource?.id
      ? nativeSubtitleState
      : null;
  const defaultSubtitleIndex = subtitleMenuSource
    ? resolvePlaybackSelection([subtitleMenuSource], playbackSelection, preferences)
        .subtitleStreamIndex
    : undefined;
  const { selectedIndex: selectedSubtitleIndex, usesServerTracks: usesServerSubtitleTracks } =
    resolveSubtitleMenuSelection({
      source: streamInfo?.mediaSource,
      playbackUrl: playbackSourceUrl,
      requestedIndex: requestedSubtitleIndex,
      serverIndex: activeServerTrackChoice?.subtitle,
      defaultIndex: defaultSubtitleIndex,
      nativeState: activeNativeSubtitles,
    });
  const menuTracks = {
    audio: usesServerTracks
      ? deriveTracks(streamInfo?.mediaSource?.MediaStreams ?? []).audio
      : mpvTracks.audio,
    subtitle:
      hasServerSubtitleMenu && subtitleMenuSource
        ? deriveSubtitleMenuTracks(
            subtitleMenuSource,
            activeNativeSubtitles?.ids ?? new Map(),
            usesServerSubtitleTracks ? undefined : selectedSubtitleIndex,
            failedSubtitleIndices,
          )
        : mpvTracks.subtitle,
  };

  const changeServerTrack = useCallback(
    (type: 'audio' | 'subtitle', index: number) => {
      const sourceId = streamInfo?.mediaSource?.Id;
      if (!sourceId) return;
      if (type === 'subtitle') {
        const localIndex = subtitleChoiceForSource(subtitleChoiceRef.current, itemId, sourceId);
        subtitleChoiceRef.current = null;
        setSubtitleChoice(null);
        rememberedTrackChoice.current.subtitle = undefined;
        manualTrackChoice.current.subtitle = false;
        if (
          shouldReloadSubtitleStream(
            index,
            localIndex,
            activeServerTrackChoice?.subtitle ?? defaultSubtitleIndex,
          )
        ) {
          activePlaybackContextRef.current = null;
          setPlaybackAttempt((attempt) => attempt + 1);
        }
      }
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
          requestedSubtitleIndex ??
          selectedSubtitleIndex ??
          (previous?.itemId === itemId && previous.sourceId === sourceId
            ? previous.subtitle
            : (streamInfo?.mediaSource?.DefaultSubtitleStreamIndex ?? undefined)),
        [type]: index,
      }));
    },
    [
      itemId,
      streamInfo?.mediaSource,
      isPlaying,
      requestedSubtitleIndex,
      selectedSubtitleIndex,
      activeServerTrackChoice?.subtitle,
      defaultSubtitleIndex,
    ],
  );

  useEffect(() => {
    if (
      requestedSubtitleIndex == null ||
      !requiresServerSubtitleSwitch(
        streamInfo?.mediaSource,
        requestedSubtitleIndex,
        playbackSourceUrl,
      )
    )
      return;
    if (activeServerTrackChoice?.subtitle !== requestedSubtitleIndex) {
      changeServerTrack('subtitle', requestedSubtitleIndex);
    }
    subtitleChoiceRef.current = null;
    setSubtitleChoice(null);
  }, [
    streamInfo?.mediaSource,
    playbackSourceUrl,
    requestedSubtitleIndex,
    activeServerTrackChoice?.subtitle,
    changeServerTrack,
  ]);

  const playbackContext = useMemo(
    () => ({ itemId, sourceUrl: playbackSourceUrl, playbackAttempt, decodingMode }),
    [itemId, playbackSourceUrl, playbackAttempt, decodingMode],
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
      !isExitingRef.current &&
      activePlaybackContextRef.current === context &&
      (!targetPlayer || player.current === targetPlayer),
    [],
  );
  const { directory: subtitleFontsDirectory, family: subtitleFontFamily } = useSubtitleFonts(
    itemId,
    subtitleMenuSource,
  );
  const fontController = useMemo(
    () =>
      createSubtitleFontController({
        directory:
          Platform.OS === 'ios'
            ? decodeURIComponent(
                new Directory(Paths.bundle, BUNDLED_SUBTITLE_FONT_DIRECTORY).uri.replace(
                  /^file:\/\//,
                  '',
                ),
              )
            : '',
        family: Platform.OS === 'ios' ? 'Noto Sans CJK SC' : 'sans-serif',
        assOverride: Platform.OS === 'ios' ? 'no' : 'scale',
      }),
    [],
  );
  useEffect(() => {
    const target = player.current;
    if (!isLoaded || !target || !isPlaybackContextActive(playbackContext, target)) return;
    let active = true;
    void fontController
      .apply(
        target,
        { directory: subtitleFontsDirectory, family: subtitleFontFamily },
        () => active && isPlaybackContextActive(playbackContext, target),
        playbackContext,
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    isLoaded,
    subtitleFontsDirectory,
    subtitleFontFamily,
    fontController,
    playbackContext,
    isPlaybackContextActive,
  ]);
  const playbackSourceInfo = useMemo(
    () =>
      derivePlaybackSourceInfo(
        playbackSourceUrl,
        streamInfo?.mediaSource,
        enableTranscoding ? maxBitrate : undefined,
      ),
    [playbackSourceUrl, streamInfo?.mediaSource, enableTranscoding, maxBitrate],
  );
  const readPlaybackMediaInfo = useCallback(async () => {
    const target = player.current;
    if (!target || !isPlayerReadyRef.current || !isPlaybackContextActive(playbackContext, target))
      return null;
    const info = await target.getMediaInfo();
    return isPlaybackContextActive(playbackContext, target) ? info : null;
  }, [playbackContext, isPlaybackContextActive]);
  const { record: recordPlaybackDiagnostic, recordProgress: recordPlaybackProgress } =
    usePlaybackDiagnostics({
      context: playbackContext,
      player,
      itemId,
      title: formatPlayerTitle(itemDetail),
      source: streamInfo?.mediaSource,
      url: playbackSourceUrl,
      selection: playbackSelection,
      sourceInfo: playbackSourceInfo,
      loaded: isLoaded,
      buffering: isBuffering,
      state: playbackState,
      appActive,
    });
  const handleQualityChange = useCallback(
    async (next: PlaybackQuality) => {
      if (next === quality) return;
      const target = player.current;
      const source = streamInfo?.mediaSource;
      let audio = activeServerTrackChoice?.audio ?? playbackSelection.audioStreamIndex;
      let subtitle =
        requestedSubtitleIndex ??
        selectedSubtitleIndex ??
        activeServerTrackChoice?.subtitle ??
        playbackSelection.subtitleStreamIndex;
      if (target && source && !usesServerTracks && isPlayerReadyRef.current) {
        try {
          const tracks = await target.getTrackList();
          if (!isPlaybackContextActive(playbackContext, target)) return;
          const indices = await target.getCurrentTrackIds();
          if (!isPlaybackContextActive(playbackContext, target)) return;
          const serverStreams = source.MediaStreams ?? [];
          audio =
            serverIndexForNativeTrack({
              type: 'Audio',
              nativeId: indices.aid,
              nativeTracks: tracks,
              serverStreams,
              externalIds: externalTrackLoads.current?.audioIds,
            }) ?? audio;
          subtitle =
            requestedSubtitleIndex ??
            serverIndexForNativeTrack({
              type: 'Subtitle',
              nativeId: indices.sid,
              nativeTracks: tracks,
              serverStreams,
              externalIds: externalTrackLoads.current?.subtitleIds,
            }) ??
            subtitle;
        } catch {
          /* The server can still resolve default tracks if native discovery fails. */
        }
      }
      if (!isPlaybackContextActive(playbackContext)) return;
      if (isLoaded) resumePausedRef.current = !isPlaying;
      if (source?.Id) {
        setVersionChoice({ itemId, id: source.Id });
        setServerTrackChoice({ itemId, sourceId: source.Id, audio, subtitle });
      }
      setQualityChoice({ itemId, quality: next });
    },
    [
      quality,
      streamInfo?.mediaSource,
      activeServerTrackChoice,
      playbackSelection,
      requestedSubtitleIndex,
      selectedSubtitleIndex,
      usesServerTracks,
      isPlaybackContextActive,
      playbackContext,
      isLoaded,
      isPlaying,
      itemId,
    ],
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
    currentTime.value = 0;
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
    setIsLoaded(false);
    setIsBuffering(true);
    setIsPlaying(false);
    setIsStopped(false);
    playbackStateRef.current = 'idle';
    setPlaybackState('idle');
    manualTrackChoice.current = { audio: false, subtitle: false };
    setMpvTracks({ audio: [], subtitle: [] });
    setCurrentTrackIds({ vid: 0, aid: 0, sid: 0 });
    setNativeSubtitleState(null);
    setFailedSubtitleIndices(new Set());
    setMediaInfo(null);
    setHdrState(null);
    setBufferInfo(null);
    isBufferingRef.current = false;
  }, [clearPlaybackSeekWatchdog, currentTime, playbackSourceUrl, playbackAttempt, decodingMode]);

  const handleCommentsLoaded = (data: DanmakuCommentsData) => {
    setManualDanmaku(data);
    setDanmakuSelectionOverride((data.tracks?.length ?? 0) > 1 ? 'merge' : 'auto');
  };

  // Resolve server stream selections against the current native track list.
  const refreshMpvTracks = useCallback(
    async (
      targetPlayer: ExpoMpvViewRef | null = player.current,
      targetSource: string | null = loadedSourceRef.current,
    ) => {
      if (!targetPlayer || !targetSource) return;

      const choice = subtitleChoiceRef.current;
      const chosenSubtitle = subtitleChoiceForSource(
        choice,
        itemId,
        streamInfo?.mediaSource?.Id ?? undefined,
      );
      const isActive = () =>
        isMountedRef.current &&
        player.current === targetPlayer &&
        loadedSourceRef.current === targetSource &&
        subtitleChoiceRef.current === choice;
      try {
        const list = await targetPlayer.getTrackList();
        const ids = await targetPlayer.getCurrentTrackIds();

        if (!isActive()) return;

        const source = streamInfo?.mediaSource;
        const externalLoads = externalTrackLoads.current;
        const activeExternalLoads =
          externalLoads?.source === targetSource && externalLoads.player === targetPlayer
            ? externalLoads
            : null;
        const namedTracks = list
          ? deriveMpvTracks(list, source?.MediaStreams ?? [], {
              isTranscoding: !!source?.TranscodingUrl,
              audioIds: activeExternalLoads?.audioIds,
              subtitleIds: activeExternalLoads?.subtitleIds,
            })
          : undefined;
        if (namedTracks) setMpvTracks(namedTracks);
        let selectedIds: Awaited<ReturnType<typeof selectPlayerSubtitleTrack>>;
        if (list && ids) {
          const { audioLanguage, subtitleLanguage, subtitlesEnabled } = preferences;
          const rememberedId = (type: 'audio' | 'subtitle') => {
            const choice = rememberedTrackChoice.current[type];
            if (choice === 'off') return -1;
            if (!choice) return undefined;
            return (
              namedTracks?.[type].find((entry) => entry.name === choice.name)?.index ??
              (choice.language
                ? preferredTrackId(
                    list.filter((entry) => entry.type === (type === 'audio' ? 'audio' : 'sub')),
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
              source?.MediaStreams?.filter(
                (entry) =>
                  entry.Type === type && !entry.IsExternal && entry.DeliveryMethod !== 'External',
              ) ?? [];
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
            chosenSubtitle != null
              ? serverTrackId('Subtitle', chosenSubtitle)
              : (rememberedId('subtitle') ??
                serverTrackId('Subtitle', playbackSelection.subtitleStreamIndex) ??
                (!subtitlesEnabled
                  ? -1
                  : ((source?.TranscodingUrl
                      ? undefined
                      : preferredTrackId(
                          list.filter((t) => t.type === 'sub'),
                          subtitleLanguage,
                        )) ?? serverTrackId('Subtitle', source?.DefaultSubtitleStreamIndex))));
          if (!manualTrackChoice.current.audio && audio != null && audio !== ids.aid) {
            await targetPlayer.setAudioTrack(audio);
            if (!isActive()) return;
            ids.aid = audio;
          }
          if (
            (chosenSubtitle != null || !manualTrackChoice.current.subtitle) &&
            subtitle != null &&
            subtitle !== ids.sid
          ) {
            recordPlaybackDiagnostic(
              'subtitle.native-select.started',
              { serverIndex: chosenSubtitle, nativeId: subtitle, previousNativeId: ids.sid },
              'pending',
            );
            selectedIds = await selectPlayerSubtitleTrack(targetPlayer, subtitle, isActive);
            if (!selectedIds) return;
            recordPlaybackDiagnostic('subtitle.native-select.confirmed', {
              serverIndex: chosenSubtitle,
              nativeId: subtitle,
              selectedIds,
            });
          }
        }
        const confirmedIds = selectedIds ?? (await targetPlayer.getCurrentTrackIds());
        if (isActive()) {
          recordPlaybackDiagnostic('player.tracks', {
            tracks: list,
            selectedIds: confirmedIds,
            requestedSubtitle: chosenSubtitle,
          });
          setCurrentTrackIds(confirmedIds);
          if (source?.Id && list) {
            setNativeSubtitleState({
              sourceUrl: targetSource,
              sourceId: source.Id,
              ...deriveNativeSubtitleState(
                list,
                source.MediaStreams ?? [],
                confirmedIds.sid,
                activeExternalLoads?.subtitleIds,
                !!source.TranscodingUrl,
              ),
            });
          }
        }
      } catch (e) {
        if (isActive())
          recordPlaybackDiagnostic(
            'player.tracks.failed',
            { error: e, requestedSubtitle: chosenSubtitle },
            'error',
          );
        if (isActive() && chosenSubtitle != null) {
          subtitleChoiceRef.current = null;
          setSubtitleChoice(null);
          manualTrackChoice.current.subtitle = true;
          rememberedTrackChoice.current.subtitle = undefined;
          setFailedSubtitleIndices((previous) => new Set([...previous, chosenSubtitle]));
          toast.error(tr('player.subtitleSwitchFailed'), {
            description: tr('player.reselectSubtitle'),
          });
        }
        console.warn('refreshMpvTracks error:', e);
      }
    },
    [streamInfo, playbackSelection, preferences, itemId, recordPlaybackDiagnostic],
  );

  const externalSubtitles = useMemo(() => {
    return deriveExternalSubtitles(
      streamInfo?.mediaSource?.MediaStreams ?? [],
      currentApi?.basePath,
      { itemId, mediaSourceId: streamInfo?.mediaSource?.Id, accessToken: currentApi?.accessToken },
    );
  }, [itemId, streamInfo?.mediaSource, currentApi?.basePath, currentApi?.accessToken]);

  const preferredExternalSubtitleIndex =
    requestedSubtitleIndex ??
    playbackSelection.subtitleStreamIndex ??
    streamInfo?.mediaSource?.DefaultSubtitleStreamIndex ??
    undefined;

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
    recordPlaybackDiagnostic('player.retry', { state: playbackStateRef.current });
    // Invalidate the old view immediately: mpv sends END_FILE after onError,
    // and that late event must not stop or report the replacement playback.
    activePlaybackContextRef.current = null;
    resumePausedRef.current ||= playbackStateRef.current === 'paused';
    setLoadFailure(null);
    setPlaybackAttempt((attempt) => attempt + 1);
  }, [recordPlaybackDiagnostic]);

  useEffect(() => {
    if (!loadFailure) return;
    Alert.alert(tr('player.playbackFailed'), loadFailure, [
      { text: tr('common.back'), style: 'cancel', onPress: () => router.back() },
      { text: tr('common.reload'), onPress: retryPlayback },
    ]);
  }, [loadFailure, retryPlayback, router]);

  useEffect(() => {
    if (streamInfoError) {
      setLoadFailure(tr('player.playbackInformationUnavailable'));
    }
  }, [streamInfoError]);

  // Subtitle loading is shown in the track menu. Optional sidecars must not
  // cover a playing video with the full-screen buffering overlay.
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

  const segments = useMemo(
    () =>
      segmentsPending
        ? []
        : resolveMediaSegments(itemDetail?.chapters ?? [], serverSegments, duration),
    [itemDetail?.chapters, serverSegments, duration, segmentsPending],
  );

  const formattedTitle = useMemo(() => {
    return formatPlayerTitle(itemDetail);
  }, [itemDetail]);

  const mediaMetadata = useMemo(
    () => ({
      title: formattedTitle,
      artwork: itemDetail
        ? mediaAdapter?.getImageInfo({ item: itemDetail, opts: { width: 512 } }).url
        : undefined,
    }),
    [formattedTitle, itemDetail, mediaAdapter],
  );

  const { hasPreviousEpisode, hasNextEpisode, previousEpisode, nextEpisode } = useMemo(
    () => deriveEpisodeNavigation(itemId, episodes),
    [itemId, episodes],
  );

  useEffect(() => {
    if (!itemDetail) return;

    const playbackPositionTicks = itemDetail.userData?.playbackPositionTicks ?? 0;
    const startTimeMs = Math.round(ticksToMilliseconds(playbackPositionTicks));
    currentTime.value = startTimeMs;
    setInitialTime(ticksToSeconds(playbackPositionTicks));
  }, [itemDetail, currentTime]);

  useEffect(() => {
    if (initialTime < 0 || !playbackContext.sourceUrl) return;
    // Snapshot each load after the initial item position has been restored. Source
    // changes and retries capture the live position without reading it during render.
    setSourceStart({
      context: playbackContext,
      positionMs: currentTime.get(),
      paused: resumePausedRef.current,
    });
  }, [currentTime, initialTime, playbackContext]);

  useEffect(() => {
    (async () => {
      if (isPlaying) {
        await activateKeepAwakeAsync();
      } else {
        await deactivateKeepAwake();
      }
    })();
  }, [isPlaying]);

  useEffect(
    () => () => {
      externalTrackLoads.current?.subtitleCache.dispose();
      externalTrackLoads.current = null;
    },
    [playbackContext],
  );

  // Serialize external loads and cache their in-flight requests per native player.
  // React effect restarts must not add the same subtitle twice or steal selection.
  useEffect(() => {
    const targetPlayer = player.current;
    const targetSource = streamInfo?.url ?? null;
    if (
      !isLoaded ||
      !targetPlayer ||
      !targetSource ||
      !currentServer?.id ||
      !currentServer.userId ||
      loadedSourceRef.current !== targetSource
    )
      return;

    if (
      externalTrackLoads.current?.player !== targetPlayer ||
      externalTrackLoads.current.source !== targetSource
    ) {
      externalTrackLoads.current?.subtitleCache.dispose();
      externalTrackLoads.current = {
        player: targetPlayer,
        source: targetSource,
        requests: createExternalTrackRequestCache(),
        subtitleIds: new Map(),
        audioIds: new Map(),
        subtitleCache: createExternalSubtitleCache({
          serverId: currentServer.id,
          userId: currentServer.userId,
          itemId,
          mediaSourceId: streamInfo?.mediaSource?.Id ?? itemId,
          sourceSize: streamInfo?.mediaSource?.Size,
        }),
      };
    }
    const loads = externalTrackLoads.current;
    const isActive = () =>
      isMountedRef.current &&
      !isExitingRef.current &&
      player.current === targetPlayer &&
      loadedSourceRef.current === targetSource;
    let cancelled = false;
    const loadTracks = async () => {
      const pending = [
        ...subtitleTracksToLoad(
          externalSubtitles,
          streamInfo?.mediaSource?.MediaStreams ?? [],
          preferredExternalSubtitleIndex,
        ).map((track) => ({
          track,
          type: 'sub' as const,
          ids: loads.subtitleIds,
        })),
        ...externalAudios.map((track) => ({ track, type: 'audio' as const, ids: loads.audioIds })),
      ];
      await loadExternalTracksProgressively(
        pending.map(({ track, type, ids }) => async () => {
          const key = externalTrackRequestKey(type, track);
          const request = loads.requests.load(
            key,
            async () => {
              const startedAt = Date.now();
              recordPlaybackDiagnostic(
                'track.prepare.started',
                { type, index: track.index, name: track.name, url: track.url },
                'pending',
              );
              try {
                const prepared =
                  type === 'sub' ? await loads.subtitleCache.prepare(track, isActive) : track;
                if (!prepared || !isActive()) return;
                recordPlaybackDiagnostic('track.prepare.ready', {
                  type,
                  index: track.index,
                  elapsedMs: Date.now() - startedAt,
                });
                recordPlaybackDiagnostic(
                  'track.native-add.started',
                  { type, index: track.index },
                  'pending',
                );
                const nativeId = await loadExternalPlayerTrack(
                  targetPlayer,
                  type,
                  prepared,
                  isActive,
                );
                if (isActive())
                  recordPlaybackDiagnostic('track.native-add.completed', {
                    type,
                    index: track.index,
                    nativeId,
                    elapsedMs: Date.now() - startedAt,
                  });
                return nativeId;
              } catch (error) {
                if (isActive())
                  recordPlaybackDiagnostic(
                    'track.load.failed',
                    { type, index: track.index, elapsedMs: Date.now() - startedAt, error },
                    'error',
                  );
                console.warn('External player track load failed', {
                  type,
                  index: track.index,
                  error: error instanceof Error ? error.name : 'Unknown error',
                });
                throw error;
              }
            },
            { cacheFailures: type === 'sub' },
          );
          try {
            const id = await request;
            if (id != null) {
              ids.set(track.index, id);
              if (type === 'sub' && isActive()) {
                setFailedSubtitleIndices((previous) => {
                  if (!previous.has(track.index)) return previous;
                  const next = new Set(previous);
                  next.delete(track.index);
                  return next;
                });
              }
            }
          } catch (error) {
            if (type === 'sub' && isActive()) {
              setFailedSubtitleIndices((previous) => new Set([...previous, track.index]));
            }
            throw error;
          }
        }),
        () => refreshMpvTracks(targetPlayer, targetSource),
        () => !cancelled && isActive(),
      );
    };
    void loadTracks();
    return () => {
      cancelled = true;
    };
  }, [
    externalSubtitles,
    externalAudios,
    isLoaded,
    refreshMpvTracks,
    streamInfo?.url,
    currentServer,
    itemId,
    streamInfo?.mediaSource,
    preferredExternalSubtitleIndex,
    subtitleChoice,
    recordPlaybackDiagnostic,
  ]);

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
      recordPlaybackDiagnostic(
        'player.seek.started',
        { targetTimeMs, generation: pendingSeek.generation },
        'pending',
      );

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
        recordPlaybackDiagnostic(
          'player.seek.watchdog',
          { generation, recovered: !!recovered.completion },
          'slow',
        );
      }, PLAYBACK_SEEK_WATCHDOG_MS);

      void playerView
        .seekTo(pendingSeek.targetTimeMs / 1000)
        .then(() => {
          if (!isPlaybackContextActive(requestContext, playerView)) return;
          recordPlaybackDiagnostic('player.seek.command-completed', { generation });
          playbackSeekGateRef.current = resolvePlaybackSeekCommand(
            playbackSeekGateRef.current,
            generation,
          );
        })
        .catch((error) => {
          if (!isPlaybackContextActive(requestContext, playerView)) return;
          recordPlaybackDiagnostic('player.seek.failed', { generation, error }, 'error');
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
      recordPlaybackDiagnostic,
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
        !canSeekPlayback({ durationMs: duration, isPlayerReady: isPlayerReadyRef.current }) ||
        loadedSourceRef.current !== streamInfo?.url ||
        !playerView ||
        !Number.isFinite(position)
      ) {
        return;
      }

      const normalizedPosition = Math.max(0, Math.min(position, 1));
      const targetTimeMs = normalizedPosition * duration; // ms
      segmentSkip.handleManualSeek(segments, targetTimeMs);
      requestNativeSeek(playerView, targetTimeMs);
      setIsStopped(false);
    },
    [duration, requestNativeSeek, streamInfo?.url, segments, segmentSkip],
  );

  // Direct-play audio uses mpv's native aid.
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
        if (player.current === targetPlayer)
          toast.error(tr('player.audioTrackSwitchFailed'), {
            description: tr('player.reselectAudioTrack'),
          });
      }
    },
    [refreshMpvTracks, usesServerTracks, changeServerTrack, mpvTracks],
  );

  const handleSubtitleTrackChange = useCallback(
    async (trackId: number) => {
      recordPlaybackDiagnostic(
        'subtitle.selection.requested',
        {
          serverIndex: trackId,
          sourceId: subtitleMenuSource?.id,
          loaded: isPlayerReadyRef.current,
          requiresServerSwitch: requiresServerSubtitleSwitch(
            streamInfo?.mediaSource,
            trackId,
            playbackSourceUrl,
          ),
        },
        'pending',
      );
      if (requiresServerSubtitleSwitch(streamInfo?.mediaSource, trackId, playbackSourceUrl)) {
        changeServerTrack('subtitle', trackId);
        return;
      }
      if (hasServerSubtitleMenu && subtitleMenuSource) {
        if (trackId !== -1 && !menuTracks.subtitle.some((track) => track.index === trackId)) return;
        const track = externalSubtitles.find((entry) => entry.index === trackId);
        const loads = externalTrackLoads.current;
        if (track && loads?.player === player.current && loads.source === loadedSourceRef.current) {
          // An explicit menu selection retries this failed subtitle, preserving other attempts.
          loads.requests.retry(externalTrackRequestKey('sub', track));
        }
        const choice = { itemId, sourceId: subtitleMenuSource.id, index: trackId };
        subtitleChoiceRef.current = choice;
        setSubtitleChoice(choice);
        setFailedSubtitleIndices((previous) => {
          if (!previous.has(trackId)) return previous;
          const next = new Set(previous);
          next.delete(trackId);
          return next;
        });
        rememberedTrackChoice.current.subtitle =
          trackId === -1 ? 'off' : menuTracks.subtitle.find((track) => track.index === trackId);
        // The choice is kept until its server stream has a real native ID.
        if (isPlayerReadyRef.current) await refreshMpvTracks();
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
        if (player.current === targetPlayer)
          toast.error(tr('player.subtitleSwitchFailed'), {
            description: tr('player.reselectSubtitle'),
          });
      }
    },
    [
      refreshMpvTracks,
      streamInfo?.mediaSource,
      playbackSourceUrl,
      changeServerTrack,
      mpvTracks,
      hasServerSubtitleMenu,
      subtitleMenuSource,
      menuTracks.subtitle,
      externalSubtitles,
      itemId,
      recordPlaybackDiagnostic,
    ],
  );

  const handleAspectRatioChange = useCallback((mode: string) => {
    setAspectRatio(mode);
    void player.current?.setPropertyString('sub-use-margins', mode === 'fill' ? 'yes' : 'no');
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
      // Update the episode in place, retaining the native route's presentation
      // and orientation while React remounts the episode's playback state.
      router.setParams({
        itemId: episodeId,
        mediaSourceId: undefined,
        audioStreamIndex: undefined,
        subtitleStreamIndex: undefined,
        quality: undefined,
      });
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
      appActive: appActive && AppState.currentState === 'active',
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
    appActive,
    playbackCompletion,
    itemId,
    itemDetail?.type,
    nextEpisode?.id,
    goToEpisode,
  ]);

  return (
    <View style={styles.container}>
      {playbackSourceUrl &&
      sourceStart?.context === playbackContext &&
      initialTime >= 0 &&
      !loadFailure ? (
        <ExpoMpvView
          key={`${itemId}:${playbackSourceUrl}:${playbackAttempt}:${decodingMode}`}
          ref={player}
          style={styles.video}
          source={playbackSourceUrl}
          startPosition={deriveStartPositionSeconds(sourceStart.positionMs, duration)}
          paused={sourceStart.paused}
          speed={rate}
          hwdec={hwdec}
          showNotificationControls
          metadata={mediaMetadata}
          onPlaybackStateChange={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            recordPlaybackDiagnostic('player.state', nativeEvent);
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
            recordPlaybackProgress(nativeEvent);
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
                syncPlaybackProgress(positionMs, playbackStateRef.current === 'paused');
              }
              const playerView = player.current;
              if (
                !decision.completion &&
                !playbackSeekGateRef.current.pendingSeek &&
                playbackStateRef.current === 'playing' &&
                isPlayerReadyRef.current &&
                playerView
              ) {
                const segment = segmentSkip.claim(segments, positionMs, {
                  intro: autoSkipIntro,
                  outro: autoSkipOutro,
                });
                if (segment) {
                  requestNativeSeek(playerView, segment.endTimeMs);
                }
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
            recordPlaybackDiagnostic('player.loaded', nativeEvent);
            isPlayerReadyRef.current = true;
            loadedSourceRef.current = playbackSourceUrl;
            // Fill crops the video, so keep plain-text subtitles within the screen.
            void player.current?.setPropertyString(
              'sub-use-margins',
              aspectRatio === 'fill' ? 'yes' : 'no',
            );
            // Native loadfile applies startPosition before presenting its first frame.
            setIsNativeSeeking(false);
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
            recordPlaybackDiagnostic(
              'player.buffer',
              nativeEvent,
              nativeEvent.isBuffering ? 'pending' : 'ok',
            );
            setIsBuffering(nativeEvent.isBuffering);
          }}
          onError={({ nativeEvent }) => {
            if (!isPlaybackContextActive(playbackContext)) return;
            recordPlaybackDiagnostic('player.error', nativeEvent, 'error');
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
            if (isPlaybackContextActive(playbackContext))
              recordPlaybackDiagnostic('player.end', nativeEvent);
            if (nativeEvent.reason === 'ended') completePlayback(playbackContext);
          }}
        />
      ) : null}

      {(showLoading || !entryControlsVisible) && (
        <LoadingIndicator
          bufferInfo={bufferInfo}
          title={playbackAttempt > 0 && !isLoaded ? tr('player.reloadingVideo') : undefined}
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
            isPlayerReady={isLoaded && !loadFailure}
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
                  t.index === (hasServerSubtitleMenu ? selectedSubtitleIndex : currentTrackIds.sid),
              ),
            }}
            onAudioTrackChange={handleAudioTrackChange}
            onSubtitleTrackChange={handleSubtitleTrackChange}
            mediaSources={mediaSources}
            selectedMediaSourceId={streamInfo?.mediaSource?.Id ?? selectedMediaSourceId}
            onMediaSourceChange={(id) => {
              if (id === streamInfo?.mediaSource?.Id) return;
              subtitleChoiceRef.current = null;
              setSubtitleChoice(null);
              resumePausedRef.current = !isPlaying;
              setVersionChoice({ itemId, id });
            }}
            decodingMode={Platform.OS === 'web' ? undefined : decodingMode}
            onDecodingModeChange={(mode) => {
              if (mode === decodingMode) return;
              // Changing hwdec on an active decoder can block the native player
              // thread. A fresh view applies the choice before loading media.
              activePlaybackContextRef.current = null;
              if (isPlayerReadyRef.current) resumePausedRef.current = !isPlaying;
              recordPlaybackDiagnostic('player.decoder.requested', {
                mode,
                hwdec: playbackHwdec(mode, Platform.OS),
                restart: true,
              });
              setStoredDecodingMode(mode);
            }}
            quality={quality}
            onQualityChange={handleQualityChange}
            playbackSourceInfo={playbackSourceInfo}
            readPlaybackMediaInfo={readPlaybackMediaInfo}
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
