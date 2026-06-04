import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import { getDeviceId, ticksToSeconds } from '@/lib/utils';
import { DandanComment } from '@/services/dandanplay';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ExpoMpvView, type ExpoMpvViewRef } from 'expo-mpv';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { Controls } from './Controls';
import { DanmakuLayer, DanmakuLayerRef } from './DanmakuLayer';
import {
  deriveDurationMs,
  deriveEpisodeNavigation,
  deriveExternalSubtitles,
  deriveTracks,
  formatPlayerTitle,
} from './playerDerived';
import { usePlayerQueries } from './usePlayerQueries';

const LoadingIndicator = ({ title }: { title?: string }) => {
  return (
    <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]} pointerEvents="none">
      <ActivityIndicator size="large" color="#fff" />
      {title && <Text style={styles.loadingTitle}>{title}</Text>}
    </View>
  );
};

export const VideoPlayer = ({ itemId }: { itemId: string }) => {
  const { currentServer, currentApi } = useMediaServers();
  const router = useRouter();
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

  // Track management
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(-1);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<number>(-1);
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

  const tracks = useMemo(() => {
    return deriveTracks(streamInfo?.mediaSource?.MediaStreams ?? []);
  }, [streamInfo?.mediaSource?.MediaStreams]);

  const externalSubtitles = useMemo(() => {
    return deriveExternalSubtitles(
      streamInfo?.mediaSource?.MediaStreams ?? [],
      currentApi?.basePath,
    );
  }, [streamInfo?.mediaSource?.MediaStreams, currentApi?.basePath]);

  const { syncPlaybackProgress, syncPlaybackStart, syncPlaybackStop } = usePlaybackSync({
    currentServer,
    itemDetail: itemDetail ?? null,
    currentTime,
    playSessionId: streamInfo?.sessionId ?? null,
  });

  const showLoading = useMemo(() => {
    return isBuffering || !streamInfo?.url || !isLoaded;
  }, [isBuffering, streamInfo?.url, isLoaded]);

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

  // Auto-load Jellyfin external subtitles when player is ready
  useEffect(() => {
    if (!isLoaded || externalSubtitles.length === 0) return;

    const loadExternalSubtitles = async () => {
      for (const sub of externalSubtitles) {
        try {
          await player.current?.addSubtitle(sub.url, 'auto', sub.name);
        } catch (error) {
          console.error(`Failed to load external subtitle: ${sub.name}`, error);
        }
      }
    };

    loadExternalSubtitles();
  }, [isLoaded, externalSubtitles]);

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

  const handleAudioTrackChange = useCallback((trackIndex: number) => {
    setSelectedAudioTrack(trackIndex);
    player.current?.setAudioTrack(trackIndex);
  }, []);

  const handleSubtitleTrackChange = useCallback((trackIndex: number) => {
    setSelectedSubtitleTrack(trackIndex);
    player.current?.setSubtitleTrack(trackIndex);
  }, []);

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

      {showLoading && <LoadingIndicator />}

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
        tracks={tracks}
        selectedTracks={{
          audio: tracks?.audio?.find((t) => t.index === selectedAudioTrack),
          subtitle: tracks?.subtitle?.find((t) => t.index === selectedSubtitleTrack),
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
});
