import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { generateDeviceProfile } from '@/lib/profiles/native';
import {
  formatBitrate,
  getCommentsByItem,
  getDeviceId,
  ticksToMilliseconds,
  ticksToSeconds,
} from '@/lib/utils';
import {
  MediaStats,
  MediaTrack,
  MediaTracks,
  VlcPlayerView,
  VlcPlayerViewRef,
} from '@/modules/vlc-player';
import { DandanComment } from '@/services/dandanplay';
import { useQuery } from '@tanstack/react-query';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
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
  const { currentServer } = useMediaServers();
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
  const [tracks, setTracks] = useState<MediaTracks | undefined>(undefined);
  const [selectedTracks, setSelectedTracks] = useState<MediaTrack | undefined>(undefined);
  const [rate, setRate] = useState(1);
  const prevRateRef = useRef<number>(1);
  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);
  const [danmakuEpisodeInfo, setDanmakuEpisodeInfo] = useState<
    { animeTitle: string; episodeTitle: string } | undefined
  >(undefined);

  const player = useRef<VlcPlayerViewRef>(null);
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
    queryKey: ['streamInfo', itemId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer || !itemDetail) return null;
      return await mediaAdapter.getStreamInfo({
        item: itemDetail,
        userId: currentServer.userId,
        deviceProfile: generateDeviceProfile(),
        startTimeTicks: itemDetail.userData?.playbackPositionTicks || 0,
        deviceId: getDeviceId(),
      });
    },
    enabled: !!currentServer && !!itemDetail,
  });

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

  useEffect(() => {
    (async () => {
      if (!isLoaded) return;
      const audioTracks = await player.current?.getAudioTracks();
      const subtitleTracks = await player.current?.getSubtitleTracks();
      setTracks((prev) => ({
        ...prev,
        audio: audioTracks ?? [],
        subtitle: subtitleTracks ?? [],
      }));
    })();
  }, [player, isLoaded]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.current?.pause();
    } else {
      player.current?.play();
    }
  }, [isPlaying, player]);

  const handleRateChange = useCallback(
    (newRate: number | null, options?: { remember?: boolean }) => {
      if (newRate == null) {
        setRate(prevRateRef.current);
        player.current?.setRate(prevRateRef.current);
        return;
      }
      if (options?.remember === false) {
        setRate(newRate);
        player.current?.setRate(newRate);
        return;
      }
      prevRateRef.current = newRate;
      setRate(newRate);
      player.current?.setRate(newRate);
    },
    [],
  );

  const handleSeek = useCallback(
    (position: number) => {
      currentTime.value = position * duration;
      player.current?.seekTo(position * duration);
      danmakuLayer.current?.seek(position * duration);
      setIsBuffering(false);
    },
    [currentTime, duration, danmakuLayer],
  );

  const handleAudioTrackChange = useCallback(
    (trackIndex: number) => {
      setSelectedTracks((prev) => ({
        ...prev,
        audio: tracks?.audio?.find((track) => track.index === trackIndex),
      }));
      player.current?.setAudioTrack(trackIndex);
    },
    [tracks?.audio],
  );

  const handleSubtitleTrackChange = useCallback(
    (trackIndex: number) => {
      setSelectedTracks((prev) => ({
        ...prev,
        subtitle: tracks?.subtitle?.find((track) => track.index === trackIndex),
      }));
      player.current?.setSubtitleTrack(trackIndex);
    },
    [tracks?.subtitle],
  );

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

  return (
    <View style={styles.container}>
      {streamInfo?.url && initialTime >= 0 && (
        <VlcPlayerView
          ref={player}
          style={styles.video}
          source={{
            uri: streamInfo.url,
            isNetwork: true,
            startPosition: initialTime,
            autoplay: true,
          }}
          onVideoProgress={(e) => {
            const { duration, currentTime: newCurrentTime } = e.nativeEvent;

            setIsLoaded(true);

            setMediaInfo({
              duration,
              currentTime: newCurrentTime,
            });
            currentTime.value = newCurrentTime;

            syncPlaybackProgress(newCurrentTime, false);

            setIsBuffering(false);
            setIsPlaying(true);
            setIsStopped(false);
          }}
          onVideoStateChange={async (e) => {
            const { state } = e.nativeEvent;
            if (state === 'Playing') {
              setIsPlaying(true);
              return;
            }

            if (state === 'Paused') {
              setIsPlaying(false);
              return;
            }

            if (state === 'Buffering') {
              setIsBuffering(true);
              return;
            }
          }}
          onVideoLoadEnd={() => {
            setIsLoaded(true);
          }}
          onVideoError={async (e) => {
            const { state } = e.nativeEvent;
            if (state === 'Error') {
              setIsBuffering(false);
              setIsPlaying(false);
              setIsStopped(true);

              Alert.alert('Error', `Error: ${state}`);
            }
          }}
          onMediaStatsChange={(e) => {
            const { stats } = e.nativeEvent;
            setMediaStats(stats);
          }}
        />
      )}

      {showLoading && (
        <LoadingIndicator
          title={mediaStats?.inputBitrate ? formatBitrate(mediaStats.inputBitrate) : undefined}
        />
      )}

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
        selectedTracks={selectedTracks}
        onAudioTrackChange={handleAudioTrackChange}
        onSubtitleTrackChange={handleSubtitleTrackChange}
        hasPreviousEpisode={hasPreviousEpisode}
        hasNextEpisode={hasNextEpisode}
        onPreviousEpisode={handlePreviousEpisode}
        onNextEpisode={handleNextEpisode}
        mediaStats={mediaStats}
        onCommentsLoaded={handleCommentsLoaded}
        danmakuEpisodeInfo={danmakuEpisodeInfo}
        danmakuComments={comments}
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
