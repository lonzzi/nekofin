import { Controls } from '@/components/player/Controls';
import { DanmakuLayer, type DanmakuLayerRef } from '@/components/player/DanmakuLayer';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { getCommentsByEpisodeId, type DandanComment } from '@/services/dandanplay';
import type { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlaybackState } from 'expo-mpv';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  generateSyntheticDanmakuPreset,
  PLAYER_LAB_DURATION_MS,
  REAL_DANMAKU_SAMPLES,
  SYNTHETIC_DANMAKU_PRESETS,
  type SyntheticDanmakuPresetId,
} from './playerLabFixtures';

type PlayerLabScreenProps = {
  onClose: () => void;
};

const PLAYBACK_STATES: readonly PlaybackState[] = [
  'playing',
  'paused',
  'buffering',
  'loading',
  'ended',
  'idle',
];
const PLAYBACK_RATES = [0.5, 1, 2, 4] as const;
const BUFFER_LEVELS = [0, 0.25, 0.6, 1] as const;
const absoluteFill = {
  bottom: 0,
  left: 0,
  position: 'absolute' as const,
  right: 0,
  top: 0,
};

const MOCK_EPISODES: MediaItem[] = Array.from({ length: 3 }, (_, index) => ({
  id: `player-lab-episode-${index + 1}`,
  name: `Player Lab Episode ${index + 1}`,
  type: 'Episode',
  raw: null,
  seriesName: 'Player Lab Fixture',
  parentIndexNumber: 1,
  indexNumber: index + 1,
}));

const MOCK_TRACKS = {
  audio: [
    { index: 1, name: '日语 · AAC 2.0', language: 'jpn' },
    { index: 2, name: '中文 · AAC 2.0', language: 'zho' },
  ],
  subtitle: [
    { index: -1, name: '关闭字幕' },
    { index: 3, name: '简体中文', language: 'zho' },
    { index: 4, name: 'English', language: 'eng' },
  ],
};

const syntheticSourceId = (id: SyntheticDanmakuPresetId) => `synthetic:${id}`;
const realSourceId = (id: string) => `real:${id}`;

export function PlayerLabScreen({ onClose }: PlayerLabScreenProps) {
  const insets = useSafeAreaInsets();
  const { settings } = useDanmakuSettings();
  const danmakuLayerRef = useRef<DanmakuLayerRef>(null);
  const requestGenerationRef = useRef(0);
  const seekFrameRef = useRef<number | null>(null);
  const realCommentsCacheRef = useRef(new Map<number, DandanComment[]>());
  const syntheticCommentsCacheRef = useRef(
    new Map<SyntheticDanmakuPresetId, DandanComment[]>([
      ['balanced', generateSyntheticDanmakuPreset('balanced')],
    ]),
  );
  const rememberedRateRef = useRef(1);

  const currentTime = useSharedValue(0);
  const bufferedProgress = useSharedValue(0.6);
  const [bufferLevel, setBufferLevel] = useState(0.6);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('paused');
  const [isSeeking, setIsSeeking] = useState(false);
  const [clockRevision, setClockRevision] = useState(0);
  const [rate, setRate] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('fit');
  const [comments, setComments] = useState<DandanComment[]>(
    () => syntheticCommentsCacheRef.current.get('balanced') ?? [],
  );
  const [danmakuEpisodeInfo, setDanmakuEpisodeInfo] = useState<
    { animeTitle: string; episodeTitle: string } | undefined
  >({ animeTitle: 'Player Lab', episodeTitle: '合成 · 常规' });
  const [selectedSourceId, setSelectedSourceId] = useState(syntheticSourceId('balanced'));
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [episodeIndex, setEpisodeIndex] = useState(1);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(1);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);

  const currentItem = MOCK_EPISODES[episodeIndex];
  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading' || playbackState === 'buffering';

  const markPlaybackEnded = useCallback(() => {
    currentTime.set(PLAYER_LAB_DURATION_MS);
    setPlaybackState('ended');
  }, [currentTime]);

  useEffect(() => {
    cancelAnimation(currentTime);
    if (playbackState !== 'playing' || isSeeking) return;

    const startTimeMs = Math.min(PLAYER_LAB_DURATION_MS, Math.max(0, currentTime.get()));
    const remainingWallTimeMs = (PLAYER_LAB_DURATION_MS - startTimeMs) / Math.max(0.25, rate);
    if (remainingWallTimeMs <= 0) {
      markPlaybackEnded();
      return;
    }

    currentTime.set(
      withTiming(
        PLAYER_LAB_DURATION_MS,
        { duration: remainingWallTimeMs, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(markPlaybackEnded);
        },
      ),
    );

    return () => cancelAnimation(currentTime);
  }, [clockRevision, currentTime, isSeeking, markPlaybackEnded, playbackState, rate]);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      if (seekFrameRef.current != null) cancelAnimationFrame(seekFrameRef.current);
      cancelAnimation(currentTime);
      danmakuLayerRef.current?.cleanup();
    },
    [currentTime],
  );

  const seekToMs = useCallback(
    (targetTimeMs: number) => {
      const nextTimeMs = Math.min(PLAYER_LAB_DURATION_MS, Math.max(0, targetTimeMs));
      cancelAnimation(currentTime);
      if (seekFrameRef.current != null) cancelAnimationFrame(seekFrameRef.current);
      setIsSeeking(true);
      danmakuLayerRef.current?.seek(nextTimeMs);
      currentTime.set(nextTimeMs);

      seekFrameRef.current = requestAnimationFrame(() => {
        seekFrameRef.current = null;
        danmakuLayerRef.current?.completeSeek(nextTimeMs, nextTimeMs);
        setIsSeeking(false);
        setClockRevision((revision) => revision + 1);
      });
    },
    [currentTime],
  );

  const handleSeek = useCallback(
    (position: number) => {
      if (!Number.isFinite(position)) return;
      seekToMs(Math.max(0, Math.min(1, position)) * PLAYER_LAB_DURATION_MS);
    },
    [seekToMs],
  );

  const handlePlayPause = useCallback(() => {
    if (playbackState === 'playing') {
      setPlaybackState('paused');
      return;
    }

    if (playbackState === 'ended' || currentTime.get() >= PLAYER_LAB_DURATION_MS) {
      seekToMs(0);
    }
    setPlaybackState('playing');
  }, [currentTime, playbackState, seekToMs]);

  const handleRateChange = useCallback(
    (nextRate: number | null, options?: { remember?: boolean }) => {
      if (nextRate == null) {
        setRate(rememberedRateRef.current);
        setClockRevision((revision) => revision + 1);
        return;
      }

      const normalizedRate = Math.max(0.25, nextRate);
      if (options?.remember !== false) rememberedRateRef.current = normalizedRate;
      setRate(normalizedRate);
      setClockRevision((revision) => revision + 1);
    },
    [],
  );

  const handlePlaybackStateChange = useCallback(
    (nextState: PlaybackState) => {
      if (nextState === 'ended') currentTime.set(PLAYER_LAB_DURATION_MS);
      if (nextState === 'idle') seekToMs(0);
      setPlaybackState(nextState);
      setClockRevision((revision) => revision + 1);
    },
    [currentTime, seekToMs],
  );

  const loadDanmakuSource = useCallback(
    async (sourceId: string) => {
      const requestGeneration = ++requestGenerationRef.current;
      setSelectedSourceId(sourceId);
      setSourceError(null);

      if (sourceId.startsWith('synthetic:')) {
        const presetId = sourceId.slice('synthetic:'.length) as SyntheticDanmakuPresetId;
        const preset = SYNTHETIC_DANMAKU_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;

        let nextComments = syntheticCommentsCacheRef.current.get(presetId);
        if (!nextComments) {
          nextComments = generateSyntheticDanmakuPreset(presetId);
          syntheticCommentsCacheRef.current.set(presetId, nextComments);
        }
        setSourceLoading(false);
        setComments(nextComments);
        setDanmakuEpisodeInfo({ animeTitle: 'Player Lab', episodeTitle: preset.label });
        seekToMs(0);
        AccessibilityInfo.announceForAccessibility(`已加载 ${nextComments.length} 条合成弹幕`);
        return;
      }

      const sampleId = sourceId.slice('real:'.length);
      const sample = REAL_DANMAKU_SAMPLES.find((item) => item.id === sampleId);
      if (!sample) return;

      setSourceLoading(true);
      try {
        let nextComments = realCommentsCacheRef.current.get(sample.episodeId);
        if (!nextComments) {
          nextComments = await getCommentsByEpisodeId(sample.episodeId);
          realCommentsCacheRef.current.set(sample.episodeId, nextComments);
        }
        if (requestGenerationRef.current !== requestGeneration) return;

        setComments(nextComments);
        setDanmakuEpisodeInfo({ animeTitle: sample.label, episodeTitle: sample.description });
        seekToMs(sample.recommendedStartSeconds * 1000);
        AccessibilityInfo.announceForAccessibility(`已加载 ${nextComments.length} 条真实弹幕`);
      } catch {
        if (requestGenerationRef.current === requestGeneration) {
          setSourceError('真实弹幕加载失败，请检查开发环境中的弹弹 Play API 配置');
        }
      } finally {
        if (requestGenerationRef.current === requestGeneration) setSourceLoading(false);
      }
    },
    [seekToMs],
  );

  const sourceStats = useMemo(() => {
    if (comments.length < 2) return `${comments.length} 条`;
    let minimumIntervalMs = Number.POSITIVE_INFINITY;
    const ordered = [...comments].sort((left, right) => left.timeInSeconds - right.timeInSeconds);
    for (let index = 1; index < ordered.length; index++) {
      const intervalMs = Math.round(
        (ordered[index].timeInSeconds - ordered[index - 1].timeInSeconds) * 1000,
      );
      if (intervalMs > 0 && intervalMs < minimumIntervalMs) minimumIntervalMs = intervalMs;
    }
    return `${comments.length} 条 · 最小间隔 ${Number.isFinite(minimumIntervalMs) ? `${minimumIntervalMs}ms` : '同时间'}`;
  }, [comments]);

  const handleCommentsLoaded = useCallback(
    (nextComments: DandanComment[], episodeInfo?: { animeTitle: string; episodeTitle: string }) => {
      requestGenerationRef.current += 1;
      setComments(nextComments);
      setDanmakuEpisodeInfo(episodeInfo);
      setSelectedSourceId('manual-search');
      setSourceError(null);
      seekToMs(0);
    },
    [seekToMs],
  );

  const selectEpisode = useCallback(
    (nextEpisodeId: string) => {
      const nextIndex = MOCK_EPISODES.findIndex((episode) => episode.id === nextEpisodeId);
      if (nextIndex < 0) return;
      setEpisodeIndex(nextIndex);
      seekToMs(0);
    },
    [seekToMs],
  );

  return (
    <View style={styles.container}>
      <TestPattern />

      {settings.enabled && comments.length > 0 ? (
        <DanmakuLayer
          ref={danmakuLayerRef}
          comments={comments}
          currentTime={currentTime}
          isSeeking={isSeeking}
          playbackRate={rate}
          playbackState={playbackState}
          {...settings}
        />
      ) : null}

      <Controls
        aspectRatio={aspectRatio}
        autoHideControls={false}
        bufferedProgress={bufferedProgress}
        currentItem={currentItem}
        currentTime={currentTime}
        danmakuComments={comments}
        danmakuEpisodeInfo={danmakuEpisodeInfo}
        duration={PLAYER_LAB_DURATION_MS}
        episodes={MOCK_EPISODES}
        hasNextEpisode={episodeIndex < MOCK_EPISODES.length - 1}
        hasPreviousEpisode={episodeIndex > 0}
        isLoading={isLoading}
        isPlaying={isPlaying}
        initiallyVisible
        onAspectRatioChange={setAspectRatio}
        onAudioTrackChange={setSelectedAudioTrack}
        onCommentsLoaded={handleCommentsLoaded}
        onEpisodeSelect={selectEpisode}
        onNextEpisode={() => selectEpisode(MOCK_EPISODES[Math.min(2, episodeIndex + 1)].id)}
        onPlayPause={handlePlayPause}
        onPreviousEpisode={() => selectEpisode(MOCK_EPISODES[Math.max(0, episodeIndex - 1)].id)}
        onRateChange={handleRateChange}
        onSeek={handleSeek}
        onSubtitleTrackChange={setSelectedSubtitleTrack}
        rate={rate}
        selectedTracks={{
          audio: MOCK_TRACKS.audio.find((track) => track.index === selectedAudioTrack),
          subtitle: MOCK_TRACKS.subtitle.find((track) => track.index === selectedSubtitleTrack),
        }}
        title="Player Lab · UI 与弹幕压力测试"
        tracks={MOCK_TRACKS}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityLabel="关闭 Player Lab"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.chromeButton,
            styles.closeButton,
            { left: Math.max(24, insets.left + 8), top: insets.top + 10 },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons color="#fff" name="close" size={23} />
        </Pressable>
        <Pressable
          accessibilityLabel="打开 Player Lab 控制台"
          accessibilityRole="button"
          onPress={() => setInspectorVisible(true)}
          style={({ pressed }) => [
            styles.labButton,
            { right: Math.max(24, insets.right + 8), top: insets.top + 64 },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons color="#0B0D12" name="flask" size={16} />
          <Text style={styles.labButtonText}>LAB</Text>
        </Pressable>
      </View>

      {inspectorVisible ? (
        <Inspector
          bufferedProgress={bufferLevel}
          commentsCountLabel={sourceStats}
          onBufferChange={(value) => {
            setBufferLevel(value);
            bufferedProgress.set(value);
          }}
          onClose={() => setInspectorVisible(false)}
          onPlaybackStateChange={handlePlaybackStateChange}
          onRateChange={(nextRate) => handleRateChange(nextRate)}
          onSeek={seekToMs}
          onSourceSelect={(sourceId) => void loadDanmakuSource(sourceId)}
          playbackState={playbackState}
          rate={rate}
          selectedSourceId={selectedSourceId}
          sourceError={sourceError}
          sourceLoading={sourceLoading}
        />
      ) : null}
    </View>
  );
}

function TestPattern() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.testPattern]} pointerEvents="none">
      <View style={styles.colorBars}>
        {['#18213A', '#1B3B4B', '#244A3A', '#51452B', '#542E3B', '#342F57'].map((color) => (
          <View key={color} style={[styles.colorBar, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={styles.patternCenter}>
        <Ionicons color="rgba(255,255,255,0.18)" name="play-circle-outline" size={72} />
        <Text style={styles.patternTitle}>PLAYER LAB</Text>
        <Text style={styles.patternSubtitle}>Deterministic playback surface · 02:00</Text>
      </View>
      <View style={styles.gridHorizontal} />
      <View style={styles.gridVertical} />
    </View>
  );
}

function Inspector({
  bufferedProgress,
  commentsCountLabel,
  onBufferChange,
  onClose,
  onPlaybackStateChange,
  onRateChange,
  onSeek,
  onSourceSelect,
  playbackState,
  rate,
  selectedSourceId,
  sourceError,
  sourceLoading,
}: {
  bufferedProgress: number;
  commentsCountLabel: string;
  onBufferChange: (value: number) => void;
  onClose: () => void;
  onPlaybackStateChange: (state: PlaybackState) => void;
  onRateChange: (rate: number) => void;
  onSeek: (timeMs: number) => void;
  onSourceSelect: (sourceId: string) => void;
  playbackState: PlaybackState;
  rate: number;
  selectedSourceId: string;
  sourceError: string | null;
  sourceLoading: boolean;
}) {
  return (
    <View accessibilityViewIsModal style={styles.inspectorOverlay}>
      <Pressable
        accessibilityLabel="关闭控制台"
        onPress={onClose}
        style={styles.inspectorBackdrop}
      />
      <View style={styles.inspectorPanel}>
        <View style={styles.inspectorHeader}>
          <View>
            <Text style={styles.inspectorEyebrow}>DEVELOPMENT ONLY</Text>
            <Text style={styles.inspectorTitle}>Player Lab</Text>
          </View>
          <Pressable
            accessibilityLabel="关闭控制台"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.inspectorClose, pressed && styles.pressed]}
          >
            <Ionicons color="#fff" name="close" size={21} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.inspectorContent}
          showsVerticalScrollIndicator={false}
        >
          <InspectorSection subtitle={commentsCountLabel} title="弹幕数据">
            {SYNTHETIC_DANMAKU_PRESETS.map((preset) => (
              <SourceButton
                key={preset.id}
                description={preset.description}
                label={preset.label}
                onPress={() => onSourceSelect(syntheticSourceId(preset.id))}
                selected={selectedSourceId === syntheticSourceId(preset.id)}
              />
            ))}
            {REAL_DANMAKU_SAMPLES.map((sample) => (
              <SourceButton
                key={sample.id}
                description={sample.description}
                label={sample.label}
                onPress={() => onSourceSelect(realSourceId(sample.id))}
                selected={selectedSourceId === realSourceId(sample.id)}
              />
            ))}
            {sourceLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#64D2FF" size="small" />
                <Text style={styles.loadingText}>正在加载真实弹幕…</Text>
              </View>
            ) : null}
            {sourceError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {sourceError}
              </Text>
            ) : null}
          </InspectorSection>

          <InspectorSection title="播放状态">
            <View style={styles.chipRow}>
              {PLAYBACK_STATES.map((state) => (
                <ChoiceChip
                  key={state}
                  label={state}
                  onPress={() => onPlaybackStateChange(state)}
                  selected={playbackState === state}
                />
              ))}
            </View>
          </InspectorSection>

          <InspectorSection title="播放倍速">
            <View style={styles.chipRow}>
              {PLAYBACK_RATES.map((nextRate) => (
                <ChoiceChip
                  key={nextRate}
                  label={`${nextRate}×`}
                  onPress={() => onRateChange(nextRate)}
                  selected={rate === nextRate}
                />
              ))}
            </View>
          </InspectorSection>

          <InspectorSection title="缓冲进度">
            <View style={styles.chipRow}>
              {BUFFER_LEVELS.map((level) => (
                <ChoiceChip
                  key={level}
                  label={`${Math.round(level * 100)}%`}
                  onPress={() => onBufferChange(level)}
                  selected={Math.abs(bufferedProgress - level) < 0.01}
                />
              ))}
            </View>
          </InspectorSection>

          <InspectorSection title="快速 Seek">
            <View style={styles.chipRow}>
              {[0, 10, 30, 60, 90, 119].map((second) => (
                <ChoiceChip
                  key={second}
                  label={`${second}s`}
                  onPress={() => onSeek(second * 1000)}
                  selected={false}
                />
              ))}
            </View>
          </InspectorSection>
        </ScrollView>
      </View>
    </View>
  );
}

function InspectorSection({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.inspectorSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SourceButton({
  description,
  label,
  onPress,
  selected,
}: {
  description: string;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sourceButton,
        selected && styles.sourceButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.sourceText}>
        <Text style={styles.sourceTitle}>{label}</Text>
        <Text style={styles.sourceDescription}>{description}</Text>
      </View>
      {selected ? <Ionicons color="#64D2FF" name="checkmark-circle" size={20} /> : null}
    </Pressable>
  );
}

function ChoiceChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        selected && styles.choiceChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#090B10',
    flex: 1,
  },
  testPattern: {
    backgroundColor: '#11151D',
    overflow: 'hidden',
  },
  colorBars: {
    flexDirection: 'row',
    height: '100%',
    opacity: 0.42,
  },
  colorBar: {
    flex: 1,
  },
  patternCenter: {
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    ...absoluteFill,
  },
  patternTitle: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
  },
  patternSubtitle: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  gridHorizontal: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  gridVertical: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: 0,
    left: '50%',
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
  chromeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(18,20,27,0.88)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
    zIndex: 100,
  },
  closeButton: {
    boxShadow: '0 7px 24px rgba(0,0,0,0.28)',
  },
  labButton: {
    alignItems: 'center',
    backgroundColor: '#64D2FF',
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 5,
    height: 34,
    paddingHorizontal: 11,
    position: 'absolute',
    zIndex: 100,
  },
  labButtonText: {
    color: '#0B0D12',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  inspectorOverlay: {
    ...absoluteFill,
    alignItems: 'flex-end',
    zIndex: 300,
  },
  inspectorBackdrop: {
    ...absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  inspectorPanel: {
    backgroundColor: '#14171E',
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    height: '100%',
    maxWidth: 420,
    width: '43%',
  },
  inspectorHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 74,
    paddingHorizontal: 18,
  },
  inspectorEyebrow: {
    color: '#64D2FF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  inspectorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  inspectorClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inspectorContent: {
    gap: 18,
    padding: 16,
    paddingBottom: 36,
  },
  inspectorSection: {
    gap: 8,
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  sectionBody: {
    gap: 7,
  },
  sourceButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sourceButtonSelected: {
    backgroundColor: 'rgba(100,210,255,0.1)',
    borderColor: 'rgba(100,210,255,0.42)',
  },
  sourceText: {
    flex: 1,
    gap: 2,
  },
  sourceTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sourceDescription: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
    lineHeight: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  choiceChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 11,
  },
  choiceChipSelected: {
    backgroundColor: '#64D2FF',
    borderColor: '#64D2FF',
  },
  choiceChipText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '600',
  },
  choiceChipTextSelected: {
    color: '#0A0C10',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
  },
  errorText: {
    color: '#FF9F9F',
    fontSize: 11,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.62,
  },
});
