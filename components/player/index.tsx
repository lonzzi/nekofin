import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import { formatBitrate, getDeviceId, ticksToSeconds } from '@/lib/utils';
import { DandanComment } from '@/services/dandanplay';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  ExpoMpvView,
  type ExpoMpvViewRef,
  type HdrStateChangeEvent,
  type PlaybackState,
  type TrackInfo,
} from 'expo-mpv';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { Controls } from './Controls';
import { DanmakuLayer, DanmakuLayerRef } from './DanmakuLayer';
import {
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
      ) : (
        title && <Text style={styles.loadingTitle}>{title}</Text>
      )}
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

  const enableTranscoding = storage.getBoolean('enableTranscoding') ?? false;
  const enableSubtitleBurnIn = storage.getBoolean('enableSubtitleBurnIn') ?? false;
  const maxBitrate = storage.getNumber('maxBitrate') ?? 0;
  const selectedCodec = storage.getString('selectedCodec') ?? 'h264';

  const [danmakuEpisodeInfo, setDanmakuEpisodeInfo] = useState<
    { animeTitle: string; episodeTitle: string } | undefined
  >(undefined);

  const player = useRef<ExpoMpvViewRef>(null);
  const hasInitialSeeked = useRef(false);
  const danmakuLayer = useRef<DanmakuLayerRef>(null);
  const currentTime = useSharedValue(0);

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

  useEffect(() => {
    setDanmakuEpisodeInfo(autoCommentsData?.episodeInfo);
  }, [autoCommentsData?.episodeInfo]);

  const comments = useManualComments ? manualComments : (autoCommentsData?.comments ?? []);

  const handleCommentsLoaded = (
    newComments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => {
    setManualComments(newComments);
    setUseManualComments(true);
    setDanmakuEpisodeInfo(episodeInfo);
  };

  // Pull the real track list from mpv. Track `index` here is mpv's own sid/aid.
  const refreshMpvTracks = useCallback(async () => {
    try {
      const list = await player.current?.getTrackList();
      const ids = await player.current?.getCurrentTrackIds();
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
      console.log('refreshMpvTracks error:', e);
    }
  }, []);

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
    if (itemDetail?.userData?.playbackPositionTicks !== undefined) {
      const startTimeMs = Math.round(itemDetail.userData.playbackPositionTicks! / 10000);
      currentTime.value = startTimeMs;
      setInitialTime(ticksToSeconds(itemDetail.userData.playbackPositionTicks!));
    }
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
    if (!isLoaded || externalSubtitles.length === 0) return;

    const loadExternalSubtitles = async () => {
      for (let i = 0; i < externalSubtitles.length; i++) {
        const sub = externalSubtitles[i];
        try {
          // Show the first external subtitle immediately ('select'); add the rest
          // without stealing selection ('auto') so the user can pick them from
          // the track menu (which is keyed by real mpv sid).
          await player.current?.addSubtitle(sub.url, i === 0 ? 'select' : 'auto', sub.name);
        } catch (error) {
          console.error(`Failed to load external subtitle: ${sub.name}`, error);
        }
      }
      await refreshMpvTracks();
    };

    loadExternalSubtitles();
  }, [isLoaded, externalSubtitles, refreshMpvTracks]);

  // Auto-load Jellyfin external audio tracks once the player is ready, then refresh
  // the mpv track list so they appear in the audio picker with their real mpv aid.
  useEffect(() => {
    if (!isLoaded || externalAudios.length === 0) return;

    const loadExternalAudios = async () => {
      for (let i = 0; i < externalAudios.length; i++) {
        const audio = externalAudios[i];
        try {
          await player.current?.addAudio(audio.url, i === 0 ? 'select' : 'auto', audio.name);
        } catch (error) {
          console.error(`Failed to load external audio: ${audio.name}`, error);
        }
      }
      await refreshMpvTracks();
    };

    loadExternalAudios();
  }, [isLoaded, externalAudios, refreshMpvTracks]);

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

  const handleSeek = useCallback(
    (position: number) => {
      const targetTimeMs = position * duration; // ms
      const targetTimeSec = targetTimeMs / 1000; // seconds for mpv
      player.current?.seekTo(targetTimeSec);
      danmakuLayer.current?.seek(targetTimeMs);
      currentTime.value = targetTimeMs;
      syncPlaybackProgress(targetTimeMs, false, { force: true });
      setIsBuffering(false);
    },
    [currentTime, duration, danmakuLayer, syncPlaybackProgress],
  );

  // trackId here is mpv's real aid/sid (from mpvTracks[].index).
  const handleAudioTrackChange = useCallback(
    (trackId: number) => {
      player.current?.setAudioTrack(trackId);
      setCurrentTrackIds((prev) => ({ ...prev, aid: trackId }));
      setTimeout(() => refreshMpvTracks(), 200);
    },
    [refreshMpvTracks],
  );

  const handleSubtitleTrackChange = useCallback(
    (trackId: number) => {
      player.current?.setSubtitleTrack(trackId);
      setCurrentTrackIds((prev) => ({ ...prev, sid: trackId }));
      setTimeout(() => refreshMpvTracks(), 200);
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

  const handlePreviousEpisode = useCallback(() => {
    if (previousEpisode?.id) {
      router.replace({
        pathname: '/player',
        params: {
          itemId: previousEpisode.id,
        },
      });
    }
  }, [previousEpisode, router]);

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode?.id) {
      router.replace({
        pathname: '/player',
        params: {
          itemId: nextEpisode.id,
        },
      });
    }
  }, [nextEpisode, router]);

  const handleEpisodeSelect = useCallback(
    (episodeId: string) => {
      router.replace({
        pathname: '/player',
        params: {
          itemId: episodeId,
        },
      });
    },
    [router],
  );

  return (
    <View style={styles.container}>
      {streamInfo?.url && initialTime >= 0 && (
        <ExpoMpvView
          ref={player}
          style={styles.video}
          source={streamInfo.url}
          onPlaybackStateChange={({ nativeEvent }) => {
            setPlaybackState(nativeEvent.state);
            setIsPlaying(nativeEvent.isPlaying);
            if (!nativeEvent.isPlaying) {
              syncPlaybackProgress(currentTime.value, true, { force: true });
            }
            if (nativeEvent.isPlaying && initialTime > 0 && !hasInitialSeeked.current) {
              hasInitialSeeked.current = true;
              player.current?.seekBy(initialTime);
            }
          }}
          onProgress={({ nativeEvent }) => {
            currentTime.value = nativeEvent.position * 1000;
            syncPlaybackProgress(currentTime.value, false);
            // Buffered-ahead ratio for the seek bar (bufferedPosition is in seconds).
            bufferedProgress.value =
              duration > 0 ? Math.min(1, (nativeEvent.bufferedPosition * 1000) / duration) : 0;
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
          onHdrStateChange={({ nativeEvent }) => {
            setHdrState(nativeEvent);
          }}
          onLoad={({ nativeEvent }) => {
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
            setTimeout(() => refreshMpvTracks(), 300);
          }}
          onBuffer={({ nativeEvent }) => {
            setIsBuffering(nativeEvent.isBuffering);
          }}
          onError={({ nativeEvent }) => {
            setIsBuffering(false);
            setIsPlaying(false);
            setIsStopped(true);
            syncPlaybackProgress(currentTime.value, true, { force: true });
            syncPlaybackStop(currentTime.value);
            Alert.alert('Error', nativeEvent.error);
          }}
          onEnd={() => {
            setIsPlaying(false);
            setIsStopped(true);
            syncPlaybackProgress(currentTime.value, true, { force: true });
            syncPlaybackStop(currentTime.value);
          }}
        />
      )}

      {showLoading && <LoadingIndicator bufferInfo={bufferInfo} />}

      {comments.length > 0 && initialTime >= 0 && (
        <DanmakuLayer
          ref={danmakuLayer}
          currentTime={currentTime}
          isPlaying={!showLoading && !isStopped && isPlaying}
          comments={comments}
          playbackRate={rate}
          {...settings}
        />
      )}

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
