import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import { getCommentsByItem, getDeviceId, ticksToMilliseconds, ticksToSeconds } from '@/lib/utils';
import { DandanComment } from '@/services/dandanplay';
import { useQuery } from '@tanstack/react-query';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ExpoMpvView, type ExpoMpvViewRef } from 'expo-mpv';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { Controls } from './Controls';
import { DanmakuLayer, DanmakuLayerRef } from './DanmakuLayer';

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

  // Track management (simplified for mpv - external subtitles only)

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

  const { data: itemDetail } = useQuery({
    queryKey: ['itemDetail', itemId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer) return null;
      const data = await mediaAdapter.getItemDetail({ itemId, userId: currentServer.userId });
      return data;
    },
    enabled: !!itemId && !!currentServer,
  });

  const { data: seriesInfo } = useQuery({
    queryKey: ['seriesInfo', itemDetail?.seriesId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer || !itemDetail?.seriesId) return null;
      const data = await mediaAdapter.getItemDetail({
        itemId: itemDetail.seriesId,
        userId: currentServer.userId,
      });
      return data;
    },
    enabled: !!itemDetail?.seriesId && !!currentServer,
  });

  const [manualComments, setManualComments] = useState<DandanComment[]>([]);
  const [useManualComments, setUseManualComments] = useState(false);

  const { data: autoCommentsData } = useQuery({
    queryKey: ['comments', itemDetail?.id, seriesInfo?.originalTitle],
    queryFn: async () => {
      if (!itemDetail || !seriesInfo?.originalTitle) {
        return { comments: [], episodeInfo: undefined };
      }
      return getCommentsByItem(itemDetail, seriesInfo.originalTitle);
    },
    enabled: !!itemDetail && !!seriesInfo?.originalTitle && !useManualComments,
    staleTime: 1000 * 60 * 5,
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

  const { data: streamInfo } = useQuery({
    queryKey: [
      'streamInfo',
      itemId,
      currentServer?.userId,
      enableTranscoding,
      maxBitrate,
      enableSubtitleBurnIn,
      selectedCodec,
    ],
    queryFn: async () => {
      if (!currentServer || !itemDetail) return null;

      if (!enableTranscoding) {
        return await mediaAdapter.getStreamInfo({
          item: itemDetail,
          userId: currentServer.userId,
          deviceProfile: generateDeviceProfile(),
          startTimeTicks: itemDetail.userData?.playbackPositionTicks || 0,
          deviceId: getDeviceId(),
        });
      }

      return await mediaAdapter.getStreamInfo({
        item: itemDetail,
        userId: currentServer.userId,
        deviceProfile: generateDeviceProfile({
          transcode: enableTranscoding,
          maxBitrate: maxBitrate,
          subtitleBurnIn: enableSubtitleBurnIn,
          codec: selectedCodec,
        }),
        startTimeTicks: itemDetail.userData?.playbackPositionTicks || 0,
        deviceId: getDeviceId(),
        alwaysBurnInSubtitleWhenTranscoding: enableSubtitleBurnIn,
      });
    },
    enabled: !!currentServer && !!itemDetail,
    staleTime: 0,
    gcTime: 0,
  });

  const externalSubtitles = useMemo(() => {
    return (
      streamInfo?.mediaSource?.MediaStreams?.filter(
        (sub) => sub.Type === 'Subtitle' && sub.DeliveryMethod === 'External',
      ).map((sub) => ({
        name: sub.DisplayTitle ?? '',
        url: `${currentApi?.basePath}${sub.DeliveryUrl ?? ''}`,
      })) ?? []
    );
  }, [streamInfo?.mediaSource?.MediaStreams, currentApi?.basePath]);

  const { syncPlaybackProgress } = usePlaybackSync({
    currentServer,
    itemDetail: itemDetail ?? null,
    currentTime,
    playSessionId: streamInfo?.sessionId ?? null,
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['episodes', itemDetail?.seasonId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer || !itemDetail?.seasonId) return [];
      const response = await mediaAdapter.getEpisodesBySeason({
        seasonId: itemDetail.seasonId,
        userId: currentServer.userId,
      });
      return response.data.Items ?? [];
    },
    enabled: !!currentServer && !!itemDetail?.seasonId,
  });

  const showLoading = useMemo(() => {
    return isBuffering || !streamInfo?.url || !isLoaded;
  }, [isBuffering, streamInfo?.url, isLoaded]);

  const duration = useMemo(() => {
    return ticksToMilliseconds(itemDetail?.runTimeTicks ?? 0) ?? mediaInfo?.duration ?? 0;
  }, [mediaInfo, itemDetail?.runTimeTicks]);

  const formattedTitle = useMemo(() => {
    if (!itemDetail) return '';
    const seriesName = itemDetail.seriesName ?? '';
    const seasonNumber = itemDetail.parentIndexNumber;
    const episodeNumber = itemDetail.indexNumber;
    const episodeName = itemDetail.name ?? '';

    if (seriesName && seasonNumber != null && episodeNumber != null) {
      return `${seriesName} S${seasonNumber}E${episodeNumber} - ${episodeName}`;
    }
    if (seriesName) {
      return episodeName ? `${seriesName} - ${episodeName}` : seriesName;
    }
    return episodeName;
  }, [itemDetail]);

  const currentEpisodeIndex = useMemo(() => {
    if (!itemId || !episodes.length) return -1;
    const index = episodes.findIndex((episode) => episode.id === itemId);
    return index;
  }, [itemId, episodes]);

  const hasPreviousEpisode = useMemo(() => {
    return currentEpisodeIndex > 0;
  }, [currentEpisodeIndex]);

  const hasNextEpisode = useMemo(() => {
    return currentEpisodeIndex >= 0 && currentEpisodeIndex < episodes.length - 1;
  }, [currentEpisodeIndex, episodes.length]);

  const previousEpisode = useMemo(() => {
    if (!hasPreviousEpisode) return null;
    return episodes[currentEpisodeIndex - 1];
  }, [hasPreviousEpisode, episodes, currentEpisodeIndex]);

  const nextEpisode = useMemo(() => {
    if (!hasNextEpisode) return null;
    return episodes[currentEpisodeIndex + 1];
  }, [hasNextEpisode, episodes, currentEpisodeIndex]);

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
      const targetTime = position * duration;
      const currentPosition = mediaInfo?.currentTime ?? 0;
      const diff = targetTime - currentPosition;
      player.current?.seekBy(diff / 1000);
      danmakuLayer.current?.seek(targetTime);
      setIsBuffering(false);
    },
    [duration, danmakuLayer, mediaInfo],
  );

  const handleAudioTrackChange = useCallback((_trackIndex: number) => {
    // MPV handles audio tracks internally - external subtitles are supported
    // Built-in track selection is handled by the player
  }, []);

  const handleSubtitleTrackChange = useCallback((_trackIndex: number) => {
    // MPV handles subtitle tracks internally - external subtitles are supported
    // Built-in track selection is handled by the player
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
            if (nativeEvent.isPlaying && initialTime > 0 && !hasInitialSeeked.current) {
              hasInitialSeeked.current = true;
              player.current?.seekBy(initialTime);
            }
          }}
          onProgress={({ nativeEvent }) => {
            setMediaInfo((prev) => ({
              duration: nativeEvent.duration,
              currentTime: nativeEvent.position,
            }));
            currentTime.value = nativeEvent.position * 1000;
            syncPlaybackProgress(nativeEvent.position, false);
            setIsBuffering(false);
          }}
          onLoad={({ nativeEvent }) => {
            setIsLoaded(true);
            setIsBuffering(false);
            setIsPlaying(true);
            setIsStopped(false);
            setMediaInfo((prev) => ({
              duration: nativeEvent.duration,
              currentTime: prev?.currentTime ?? 0,
            }));
          }}
          onBuffer={({ nativeEvent }) => {
            setIsBuffering(nativeEvent.isBuffering);
          }}
          onError={({ nativeEvent }) => {
            setIsBuffering(false);
            setIsPlaying(false);
            setIsStopped(true);
            Alert.alert('Error', nativeEvent.error);
          }}
          onEnd={() => {
            setIsPlaying(false);
            setIsStopped(true);
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
        onAudioTrackChange={handleAudioTrackChange}
        onSubtitleTrackChange={handleSubtitleTrackChange}
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
