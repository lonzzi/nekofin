// @refresh reset

import { defaultSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { DandanComment } from '@/services/dandanplay';
import type { PlaybackState } from 'expo-mpv';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SharedValue } from 'react-native-reanimated';

import { Bullet } from './Bullet';
import { calculateDanmakuActiveHardLimit } from './danmakuCollision';
import { filterDanmakuComments } from './danmakuFilters';
import { addDanmakuLaneBullet, createDanmakuLaneOccupancy, pickDanmakuLane } from './danmakuLanes';
import {
  calculateDanmakuLayout,
  calculateDanmakuRows,
  createActiveDanmakuBullet,
  estimateDanmakuTextWidth,
} from './danmakuLayout';
import {
  calculateDanmakuSchedulerResolutionMs,
  calculateDanmakuWakeDelayMs,
  collectDueDanmakuEntries,
  findFirstTimedCommentAtOrAfter,
  findNextDanmakuEventTimeMs,
  normalizeDanmakuPlaybackRate,
  prepareDanmakuTimeline,
  removeExpiredDanmakuEntries,
  shiftDanmakuTimeline,
  type TimedDanmakuEntry,
} from './danmakuScheduler';
import { ActiveBullet, DanmakuSettingsType } from './DanmakuTypes';

export type DanmakuLayerRef = {
  seek: (timeMs: number) => void;
  completeSeek: (playbackTimeMs: number, cursorTimeMs: number) => void;
  syncPlaybackTime: (timeMs: number) => void;
  cleanup: () => void;
};

type DanmakuLayerProps = {
  ref?: React.RefObject<DanmakuLayerRef | null>;
  currentTime: SharedValue<number>;
  isSeeking: boolean;
  playbackState: PlaybackState;
  comments: DandanComment[];
  density?: number;
  playbackRate?: number;
  viewport?: { width: number; height: number };
} & Partial<DanmakuSettingsType>;

const CLOCK_DRIFT_RESET_THRESHOLD_MS = 750;
const MAX_LATE_COMMENT_WALL_MS = 250;
const MAX_ACCEPTED_PER_SCHEDULER_RUN = 24;
const MAX_CANDIDATES_PER_SCHEDULER_RUN = 96;
const MAX_TEXT_WIDTH_CACHE_SIZE = 2048;

export function DanmakuLayer({
  ref,
  currentTime,
  isSeeking,
  playbackState,
  comments,
  density = 1,
  playbackRate = 1,
  opacity = defaultSettings.opacity,
  speed = defaultSettings.speed,
  fontSize = defaultSettings.fontSize,
  heightRatio = defaultSettings.heightRatio,
  danmakuFilter = defaultSettings.danmakuFilter,
  danmakuModeFilter = defaultSettings.danmakuModeFilter,
  danmakuDensityLimit = defaultSettings.danmakuDensityLimit,
  collisionPolicy = defaultSettings.collisionPolicy,
  curEpOffset = defaultSettings.curEpOffset,
  fontFamily = defaultSettings.fontFamily,
  fontWeight = defaultSettings.fontWeight,
  viewport,
}: DanmakuLayerProps) {
  const windowDimensions = useWindowDimensions();
  const { width, height } = viewport ?? windowDimensions;
  const safePlaybackRate = normalizeDanmakuPlaybackRate(playbackRate);
  const [active, setActive] = useState<ActiveBullet[]>([]);
  const activeRef = useRef<ActiveBullet[]>([]);
  const timedCommentsRef = useRef<TimedDanmakuEntry<DandanComment>[]>([]);
  const nextCommentIndexRef = useRef(0);
  const nextBulletInstanceIdRef = useRef(0);
  const schedulerResolutionRef = useRef(16);
  const schedulerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulerDeadlineRef = useRef<number | null>(null);
  const schedulerTimerTokenRef = useRef(0);
  const runSchedulerRef = useRef<() => void>(() => {});
  const scheduleNextWakeRef = useRef<() => void>(() => {});
  const playbackStateRef = useRef<PlaybackState>(playbackState);
  const playbackRateRef = useRef(normalizeDanmakuPlaybackRate(playbackRate));
  const playbackClockRef = useRef({ mediaTimeMs: 0, wallTimeMs: 0 });
  const isSeekingRef = useRef(isSeeking);

  const widthCacheRef = useRef<Map<string, number>>(new Map());
  const lineHeight = fontSize + 8;
  const rows = calculateDanmakuRows({ height, heightRatio, lineHeight, density });

  const layout = useMemo(() => calculateDanmakuLayout(rows), [rows]);

  const densityIndex = Math.max(0, Math.min(4, Math.trunc(danmakuDensityLimit)));
  const rowMinGapPx = [40, 24, 40, 56, 72][densityIndex];
  const activeHardLimit = calculateDanmakuActiveHardLimit(layout.scrollRows, densityIndex);
  const clearSchedulerTimer = useCallback(() => {
    schedulerTimerTokenRef.current += 1;
    if (schedulerTimerRef.current) {
      clearTimeout(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    schedulerDeadlineRef.current = null;
  }, []);

  const clearActiveBullets = useCallback(() => {
    activeRef.current = [];
    setActive([]);
  }, []);

  const pruneExpiredBullets = useCallback((timeMs: number) => {
    const retained = removeExpiredDanmakuEntries(activeRef.current, timeMs);
    if (retained === activeRef.current) return;
    activeRef.current = retained;
    setActive(retained);
  }, []);

  const shiftActiveTimeline = useCallback((deltaMs: number) => {
    if (!Number.isFinite(deltaMs) || Math.abs(deltaMs) < 1) return;

    // Existing bullets keep animating on the UI thread. Shift only their media
    // lifecycle anchors so a small native clock correction cannot remove them
    // before their StrokeText animation actually reaches the edge.
    activeRef.current = shiftDanmakuTimeline(activeRef.current, deltaMs);
  }, []);

  const handleCleanup = useCallback(() => {
    clearSchedulerTimer();
    clearActiveBullets();
    nextCommentIndexRef.current = 0;
    isSeekingRef.current = false;
  }, [clearActiveBullets, clearSchedulerTimer]);

  const estimateTextWidth = useCallback(
    (text: string): number => {
      const key = `${fontFamily}|${fontWeight}|${fontSize}|${text}`;
      const cached = widthCacheRef.current.get(key);
      if (cached != null) return cached;
      const val = estimateDanmakuTextWidth({ text, fontSize });
      if (widthCacheRef.current.size >= MAX_TEXT_WIDTH_CACHE_SIZE) {
        const oldestKey = widthCacheRef.current.keys().next().value;
        if (oldestKey != null) widthCacheRef.current.delete(oldestKey);
      }
      widthCacheRef.current.set(key, val);
      return val;
    },
    [fontFamily, fontSize, fontWeight],
  );

  const runtime = useMemo(
    () => ({
      height,
      heightRatio,
      lineHeight,
      layout,
      playbackRate: safePlaybackRate,
      speed,
      width,
    }),
    [height, heightRatio, lineHeight, layout, safePlaybackRate, speed, width],
  );

  const createDanmakuBullet = useCallback(
    (comment: DandanComment, scheduledMs: number): ActiveBullet => {
      nextBulletInstanceIdRef.current += 1;
      return createActiveDanmakuBullet({
        comment,
        instanceId: nextBulletInstanceIdRef.current,
        rowIndex: 0,
        scheduledMs,
        textWidth: estimateTextWidth(comment.text),
        runtime,
      });
    },
    [estimateTextWidth, runtime],
  );

  // 弹幕过滤和密度控制
  const filteredComments = useMemo(
    () =>
      filterDanmakuComments(comments, {
        curEpOffset,
        danmakuFilter,
        danmakuModeFilter,
        danmakuDensityLimit,
        width,
        height,
        heightRatio,
        speed,
        fontSize,
      }),
    [
      comments,
      curEpOffset,
      danmakuFilter,
      danmakuModeFilter,
      danmakuDensityLimit,
      width,
      height,
      heightRatio,
      speed,
      fontSize,
    ],
  );

  const timedComments = useMemo(() => prepareDanmakuTimeline(filteredComments), [filteredComments]);
  const schedulerResolutionMs = useMemo(
    () => calculateDanmakuSchedulerResolutionMs(timedComments),
    [timedComments],
  );

  const getEstimatedPlaybackTime = useCallback((wallTimeMs = performance.now()) => {
    const clock = playbackClockRef.current;
    if (playbackStateRef.current !== 'playing' || isSeekingRef.current) {
      return clock.mediaTimeMs;
    }

    return (
      clock.mediaTimeMs +
      Math.max(0, wallTimeMs - clock.wallTimeMs) *
        normalizeDanmakuPlaybackRate(playbackRateRef.current)
    );
  }, []);

  const resetTimelineAt = useCallback(
    (timeMs: number, wallTimeMs = performance.now()) => {
      const safeTimeMs = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
      clearSchedulerTimer();
      playbackClockRef.current = { mediaTimeMs: safeTimeMs, wallTimeMs };
      nextCommentIndexRef.current = findFirstTimedCommentAtOrAfter(
        timedCommentsRef.current,
        safeTimeMs,
      );
      clearActiveBullets();
    },
    [clearActiveBullets, clearSchedulerTimer],
  );

  const getNextScheduledEventTime = useCallback(() => {
    const nextComment = timedCommentsRef.current[nextCommentIndexRef.current];
    return findNextDanmakuEventTimeMs({
      activeBullets: activeRef.current,
      nextCommentTimeMs: nextComment?.timeMs ?? null,
    });
  }, []);

  const scheduleNextWake = useCallback(() => {
    clearSchedulerTimer();
    if (playbackStateRef.current !== 'playing' || isSeekingRef.current) return;

    const nextEventTimeMs = getNextScheduledEventTime();
    const delayMs = calculateDanmakuWakeDelayMs({
      currentTimeMs: getEstimatedPlaybackTime(),
      nextCommentTimeMs: nextEventTimeMs,
      playbackRate: playbackRateRef.current,
      resolutionMs: schedulerResolutionRef.current,
    });
    if (delayMs == null) return;

    const timerToken = schedulerTimerTokenRef.current;
    schedulerDeadlineRef.current = performance.now() + delayMs;
    schedulerTimerRef.current = setTimeout(() => {
      if (timerToken !== schedulerTimerTokenRef.current) return;
      schedulerTimerRef.current = null;
      schedulerDeadlineRef.current = null;
      runSchedulerRef.current();
    }, delayMs);
  }, [clearSchedulerTimer, getEstimatedPlaybackTime, getNextScheduledEventTime]);

  const runScheduler = useCallback(() => {
    if (playbackStateRef.current !== 'playing' || isSeekingRef.current) return;

    const nowMs = getEstimatedPlaybackTime();
    const safeRate = normalizeDanmakuPlaybackRate(playbackRateRef.current);

    const { due, nextIndex } = collectDueDanmakuEntries({
      comments: timedCommentsRef.current,
      maxCandidates: MAX_CANDIDATES_PER_SCHEDULER_RUN,
      minimumCandidateTimeMs: nowMs - MAX_LATE_COMMENT_WALL_MS * safeRate,
      startIndex: nextCommentIndexRef.current,
      // Never mount a future comment just to fill the current frame window.
      // Equal-time bursts and comments already due after a delayed callback are
      // still consumed together, without creating an early one-frame flash.
      throughTimeMs: nowMs,
    });
    nextCommentIndexRef.current = nextIndex;

    const retainedActive = removeExpiredDanmakuEntries(activeRef.current, nowMs);
    let nextActive =
      retainedActive.length === activeRef.current.length ? activeRef.current : retainedActive;
    let didChangeActive = retainedActive.length !== activeRef.current.length;
    if (didChangeActive) activeRef.current = nextActive;
    const occupancy = createDanmakuLaneOccupancy(activeRef.current, lineHeight);

    let acceptedThisRun = 0;
    for (const { comment, timeMs } of due) {
      if ((nowMs - timeMs) / safeRate > MAX_LATE_COMMENT_WALL_MS) continue;
      if (
        nextActive.length >= activeHardLimit ||
        acceptedThisRun >= MAX_ACCEPTED_PER_SCHEDULER_RUN
      ) {
        continue;
      }

      // A timer can wake up to one frame late. Place every accepted entry on
      // the current media clock so lane occupancy, expiry, and animation all
      // share one timestamp instead of making a late comment jump mid-flight.
      const candidate = createDanmakuBullet(comment, nowMs);
      const picked = pickDanmakuLane({
        bullet: candidate,
        collisionPolicy,
        occupancy,
        rowMinGapPx,
        runtime,
      });
      if (!picked) continue;
      if (!didChangeActive) {
        nextActive = activeRef.current.slice();
        activeRef.current = nextActive;
        didChangeActive = true;
      }

      const bullet = { ...candidate, top: picked.top };
      nextActive.push(bullet);
      acceptedThisRun += 1;
      addDanmakuLaneBullet(occupancy, bullet, lineHeight);
    }

    if (didChangeActive) setActive(nextActive);
    scheduleNextWakeRef.current();
  }, [
    activeHardLimit,
    createDanmakuBullet,
    getEstimatedPlaybackTime,
    lineHeight,
    collisionPolicy,
    rowMinGapPx,
    runtime,
  ]);

  useEffect(() => {
    runSchedulerRef.current = runScheduler;
    scheduleNextWakeRef.current = scheduleNextWake;
  }, [runScheduler, scheduleNextWake]);

  useEffect(() => {
    timedCommentsRef.current = timedComments;
    schedulerResolutionRef.current = schedulerResolutionMs;
    const rawTimeMs = currentTime.get();
    const anchorTimeMs =
      isSeekingRef.current || playbackClockRef.current.wallTimeMs === 0
        ? rawTimeMs
        : getEstimatedPlaybackTime();

    // Rebuilding filters/layout must not release an in-flight native seek.
    resetTimelineAt(anchorTimeMs);
    if (!isSeekingRef.current) scheduleNextWakeRef.current();
  }, [
    currentTime,
    getEstimatedPlaybackTime,
    layout,
    resetTimelineAt,
    schedulerResolutionMs,
    timedComments,
  ]);

  useEffect(() => {
    if (isSeekingRef.current === isSeeking) return;
    isSeekingRef.current = isSeeking;
    resetTimelineAt(currentTime.get());
    if (!isSeeking) scheduleNextWakeRef.current();
  }, [currentTime, isSeeking, resetTimelineAt]);

  useEffect(() => {
    const now = performance.now();
    const estimatedTimeMs = getEstimatedPlaybackTime(now);

    playbackStateRef.current = playbackState;
    playbackRateRef.current = safePlaybackRate;
    playbackClockRef.current = {
      mediaTimeMs: estimatedTimeMs,
      wallTimeMs: now,
    };

    pruneExpiredBullets(estimatedTimeMs);
    clearSchedulerTimer();

    if (playbackState === 'ended' || playbackState === 'idle') {
      nextCommentIndexRef.current = findFirstTimedCommentAtOrAfter(
        timedCommentsRef.current,
        playbackClockRef.current.mediaTimeMs,
      );
      clearActiveBullets();
      return;
    }

    if (playbackState === 'playing') scheduleNextWakeRef.current();
  }, [
    clearActiveBullets,
    clearSchedulerTimer,
    getEstimatedPlaybackTime,
    playbackState,
    pruneExpiredBullets,
    safePlaybackRate,
  ]);

  const handleSeek = useCallback(
    (timeMs: number) => {
      if (!Number.isFinite(timeMs) || timeMs < 0) return;
      isSeekingRef.current = true;
      resetTimelineAt(timeMs);
    },
    [resetTimelineAt],
  );

  const handleCompleteSeek = useCallback(
    (playbackTimeMs: number, cursorTimeMs: number) => {
      const safePlaybackTimeMs = Math.max(0, Number.isFinite(playbackTimeMs) ? playbackTimeMs : 0);
      const safeCursorTimeMs = Math.max(
        0,
        Number.isFinite(cursorTimeMs) ? cursorTimeMs : safePlaybackTimeMs,
      );

      isSeekingRef.current = false;
      clearSchedulerTimer();
      playbackClockRef.current = {
        mediaTimeMs: safePlaybackTimeMs,
        wallTimeMs: performance.now(),
      };
      nextCommentIndexRef.current = findFirstTimedCommentAtOrAfter(
        timedCommentsRef.current,
        safeCursorTimeMs,
      );
      scheduleNextWakeRef.current();
    },
    [clearSchedulerTimer],
  );

  const handleSyncPlaybackTime = useCallback(
    (timeMs: number) => {
      if (!Number.isFinite(timeMs) || timeMs < 0 || isSeekingRef.current) return;

      const now = performance.now();
      const estimatedTimeMs = getEstimatedPlaybackTime(now);
      const safeRate = normalizeDanmakuPlaybackRate(playbackRateRef.current);
      const driftWallTimeMs = Math.abs(timeMs - estimatedTimeMs) / safeRate;

      if (driftWallTimeMs > CLOCK_DRIFT_RESET_THRESHOLD_MS) {
        // Native reports can be delayed/coalesced. Only an explicit seek should
        // clear visible bullets; a clock correction must preserve their flight.
        nextCommentIndexRef.current = Math.max(
          nextCommentIndexRef.current,
          findFirstTimedCommentAtOrAfter(timedCommentsRef.current, timeMs),
        );
      }

      shiftActiveTimeline(timeMs - estimatedTimeMs);
      playbackClockRef.current = { mediaTimeMs: timeMs, wallTimeMs: now };

      const deadlineMs = schedulerDeadlineRef.current;
      const nextEventTimeMs = getNextScheduledEventTime();
      if (deadlineMs == null || nextEventTimeMs == null) return;

      const revisedDelayMs = calculateDanmakuWakeDelayMs({
        currentTimeMs: timeMs,
        nextCommentTimeMs: nextEventTimeMs,
        playbackRate: safeRate,
        resolutionMs: schedulerResolutionRef.current,
      });
      if (
        revisedDelayMs != null &&
        Math.abs(now + revisedDelayMs - deadlineMs) >
          Math.max(32, schedulerResolutionRef.current * 2)
      ) {
        scheduleNextWakeRef.current();
      }
    },
    [getEstimatedPlaybackTime, getNextScheduledEventTime, shiftActiveTimeline],
  );

  useImperativeHandle(
    ref,
    () => ({
      seek: handleSeek,
      completeSeek: handleCompleteSeek,
      syncPlaybackTime: handleSyncPlaybackTime,
      cleanup: handleCleanup,
    }),
    [handleCleanup, handleCompleteSeek, handleSeek, handleSyncPlaybackTime],
  );

  useEffect(
    () => () => {
      clearSchedulerTimer();
    },
    [clearSchedulerTimer],
  );

  const effectiveOpacity = danmakuFilter === 15 ? 0 : opacity;

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: effectiveOpacity }]} pointerEvents="none">
      <View style={{ height: Math.max(0, height * heightRatio), overflow: 'hidden', width }}>
        {active.map((b) => (
          <MemoBullet
            key={b.instanceId}
            width={width}
            data={b}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fontWeight={fontWeight}
            isPlaying={playbackState === 'playing'}
            playbackRate={safePlaybackRate}
          />
        ))}
      </View>
    </View>
  );
}

const MemoBullet = React.memo(Bullet, (previous, next) => {
  if (
    previous.width !== next.width ||
    previous.fontSize !== next.fontSize ||
    previous.fontFamily !== next.fontFamily ||
    previous.fontWeight !== next.fontWeight ||
    previous.isPlaying !== next.isPlaying ||
    previous.playbackRate !== next.playbackRate
  ) {
    return false;
  }

  if (previous.data === next.data) return true;

  // Native clock correction shifts timeline anchors for collision bookkeeping
  // only. Ignore those fields so the next scheduler update does not rerender
  // every expensive StrokeTextView.
  return (
    previous.data.instanceId === next.data.instanceId &&
    previous.data.text === next.data.text &&
    previous.data.colorHex === next.data.colorHex &&
    previous.data.mode === next.data.mode &&
    previous.data.top === next.data.top &&
    previous.data.startOffsetMs === next.data.startOffsetMs &&
    previous.data.durationMs === next.data.durationMs &&
    previous.data.textWidth === next.data.textWidth
  );
});

export default DanmakuLayer;
