import { useCurrentTime } from '@/hooks/useCurrentTime';
import { usePreciseTimer } from '@/hooks/usePreciseTimer';
import { defaultSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { sleep } from '@/lib/utils';
import { DANDAN_COMMENT_MODE, DandanComment } from '@/services/dandanplay';
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
import { filterDanmakuComments } from './danmakuFilters';
import {
  calculateDanmakuLayout,
  calculateDanmakuRows,
  calculateEffectiveScrollSpeed,
  calculateScrollDurationMs,
  createActiveDanmakuBullet,
  estimateDanmakuTextWidth,
} from './danmakuLayout';
import { ActiveBullet, DanmakuSettingsType } from './DanmakuTypes';

export type DanmakuLayerRef = {
  seek: (timeMs: number) => void;
  cleanup: () => void;
};

type DanmakuLayerProps = {
  ref?: React.RefObject<DanmakuLayerRef | null>;
  currentTime: SharedValue<number>;
  isPlaying: boolean;
  comments: DandanComment[];
  density?: number;
  playbackRate?: number;
} & Partial<DanmakuSettingsType>;

type TimedDanmakuComment = {
  comment: DandanComment;
  timeMs: number;
};

function findFirstTimedCommentAtOrAfter(comments: TimedDanmakuComment[], timeMs: number) {
  let low = 0;
  let high = comments.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (comments[mid].timeMs < timeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function DanmakuLayer({
  ref,
  currentTime,
  isPlaying,
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
  curEpOffset = defaultSettings.curEpOffset,
  fontFamily = defaultSettings.fontFamily,
  fontWeight = defaultSettings.fontWeight,
}: DanmakuLayerProps) {
  const {
    time: currentTimeMs,
    sync,
    stop,
    start,
  } = usePreciseTimer({
    interval: 100,
    isRunning: isPlaying,
    playbackRate,
  });

  const videoTime = useCurrentTime({ time: currentTime });

  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState<ActiveBullet[]>([]);
  const lastTimeMsRef = useRef<number>(-1);
  const processedCommentsRef = useRef<Set<number>>(new Set());
  const nextCommentIndexRef = useRef(0);

  const widthCacheRef = useRef<Map<string, number>>(new Map());
  const lineHeight = fontSize + 8;
  const rows = calculateDanmakuRows({ height, heightRatio, lineHeight, density });

  const layout = useMemo(() => calculateDanmakuLayout(rows), [rows]);

  const rowMinGapPx = 50;
  const scrollLaneNextAvailableRef = useRef<number[]>([]);
  const topLaneNextAvailableRef = useRef<number[]>([]);
  const bottomLaneNextAvailableRef = useRef<number[]>([]);

  const ensureLanes = useCallback(() => {
    if (scrollLaneNextAvailableRef.current.length !== layout.scrollRows) {
      scrollLaneNextAvailableRef.current = new Array(layout.scrollRows).fill(0);
    }
    if (topLaneNextAvailableRef.current.length !== layout.topRows) {
      topLaneNextAvailableRef.current = new Array(layout.topRows).fill(0);
    }
    if (bottomLaneNextAvailableRef.current.length !== layout.bottomRows) {
      bottomLaneNextAvailableRef.current = new Array(layout.bottomRows).fill(0);
    }
  }, [layout.scrollRows, layout.topRows, layout.bottomRows]);

  const handleCleanup = useCallback(() => {
    setActive([]);
    processedCommentsRef.current.clear();
    ensureLanes();
    scrollLaneNextAvailableRef.current.fill(0);
    topLaneNextAvailableRef.current.fill(0);
    bottomLaneNextAvailableRef.current.fill(0);
    lastTimeMsRef.current = -1;
    nextCommentIndexRef.current = 0;
  }, [ensureLanes]);

  const handleSeek = useCallback(
    async (timeMs: number) => {
      stop();
      sync(timeMs);
      start();
      await sleep(100);
      handleCleanup();
    },
    [handleCleanup, start, stop, sync],
  );

  useImperativeHandle(
    ref,
    () => ({
      seek: (timeMs: number) => {
        handleSeek(timeMs);
      },
      cleanup: () => {
        handleCleanup();
      },
    }),
    [handleCleanup, handleSeek],
  );

  const estimateTextWidth = useCallback(
    (text: string): number => {
      const key = `${fontSize}|${text}`;
      const cached = (widthCacheRef.current as Map<string, number>).get(key);
      if (cached != null) return cached;
      const val = estimateDanmakuTextWidth({ text, fontSize, containerWidth: width });
      if (widthCacheRef.current.size > 10000) widthCacheRef.current.clear();
      widthCacheRef.current.set(key, val);
      return val;
    },
    [fontSize, width],
  );

  // 根据文字长度调整速度（长弹幕更快），返回 px/s
  const computeEffectiveSpeed = useCallback(
    (textWidth: number): number =>
      calculateEffectiveScrollSpeed({ textWidth, speed, width, playbackRate }),
    [speed, width, playbackRate],
  );

  const createDanmakuBullet = useCallback(
    (
      comment: DandanComment,
      rowIndex: number,
      startOffsetMs: number = 0,
      scheduledMs: number = 0,
    ): ActiveBullet => {
      return createActiveDanmakuBullet({
        comment,
        rowIndex,
        startOffsetMs,
        scheduledMs,
        textWidth: estimateTextWidth(comment.text),
        runtime: {
          height,
          heightRatio,
          lineHeight,
          layout,
          playbackRate,
          speed,
          width,
        },
      });
    },
    [estimateTextWidth, lineHeight, height, heightRatio, layout, playbackRate, speed, width],
  );

  const pickScrollRow = useCallback(
    (
      tMs: number,
      text: string,
    ): { rowIndex: number; nextAvailableMs: number; scheduledMs: number } | null => {
      ensureLanes();
      const newTextWidth = estimateTextWidth(text);
      const vEff = computeEffectiveSpeed(newTextWidth); // px/s
      const vEffPxPerMs = Math.max(0.01, vEff / 1000);
      const newDurationMs = calculateScrollDurationMs({
        width,
        textWidth: newTextWidth,
        speed: vEff,
      });
      const newTotalDistance = width + newTextWidth + 300;
      const deltaCurrMs = Math.ceil(((newTextWidth + rowMinGapPx) / Math.max(1, vEff)) * 1000);
      const gapBuffer = Math.max(8, newTextWidth * 0.05);

      let bestChoice = -1;
      let bestScheduleMs = tMs + 10000;

      for (let i = 0; i < layout.scrollRows; i++) {
        const laneAvail = scrollLaneNextAvailableRef.current[i] ?? 0;
        let earliestStartMs = Math.max(laneAvail, tMs);

        const rowTop = i * lineHeight;
        const activeInRow = active.filter(
          (b) =>
            (b.mode === DANDAN_COMMENT_MODE.Scroll ||
              b.mode === DANDAN_COMMENT_MODE.ScrollBottom) &&
            Math.abs(b.top - rowTop) < lineHeight / 2,
        );

        const requiredGapBase = Math.max(rowMinGapPx, gapBuffer);

        let adjustedScheduleMs = earliestStartMs;
        const maxProbeMs = tMs + 6000; // 最多等6秒避免饿死

        const willOverlapAt = (probeMs: number): boolean => {
          for (const b of activeInRow) {
            const elapsed = probeMs - b.scheduledMs + Math.max(0, b.startOffsetMs || 0);
            if (elapsed <= 0) continue; // 还未出现
            if (elapsed >= b.durationMs) continue; // 已经离场

            const progress = Math.max(0, Math.min(1, elapsed / b.durationMs));
            const prevTextWidth = b.textWidth || estimateTextWidth(b.text);
            const requiredGap = Math.max(requiredGapBase, prevTextWidth * 0.15);

            if (b.mode === DANDAN_COMMENT_MODE.Scroll) {
              // 左滚（从右到左）
              const totalDist = width + (b.textWidth || estimateTextWidth(b.text)) + 300;
              const headX = width - totalDist * progress;
              const tailX = headX + prevTextWidth;
              // 入场门槛：前车尾部需越过安全阈值
              if (tailX > width - requiredGap) return true;

              // 追尾检测：新车更快会在可视窗口内追上
              const prevV = totalDist / Math.max(1, b.durationMs); // px/ms
              const newV = newTotalDistance / Math.max(1, newDurationMs); // px/ms
              if (newV > prevV) {
                const d0 = width - tailX; // 初始 head_new - tail_prev
                const surplus = d0 - requiredGap; // 初始冗余间距
                if (surplus >= 0) {
                  const tCatch = surplus / (newV - prevV);
                  const remPrev = Math.max(0, b.durationMs - elapsed);
                  if (tCatch >= 0 && tCatch < remPrev - 30) return true;
                }
              }
            } else if (b.mode === DANDAN_COMMENT_MODE.ScrollBottom) {
              // 右滚（从左到右）
              const totalDist = width + (b.textWidth || estimateTextWidth(b.text)) + 300;
              const headX = -100 + totalDist * progress;
              const tailX = headX + prevTextWidth;
              // 入场门槛：前车头部需进入可视区域一定距离
              if (headX < requiredGap) return true;

              // 追尾检测
              const prevV = totalDist / Math.max(1, b.durationMs); // px/ms
              const newV = newTotalDistance / Math.max(1, newDurationMs); // px/ms
              if (newV > prevV) {
                const d0 = tailX - -100; // 初始 tail_prev - head_new
                const surplus = d0 - requiredGap;
                if (surplus >= 0) {
                  const tCatch = surplus / (newV - prevV);
                  const remPrev = Math.max(0, b.durationMs - elapsed);
                  if (tCatch >= 0 && tCatch < remPrev - 30) return true;
                }
              }
            }
          }
          return false;
        };

        // 如果当前时刻会重叠，则推迟至不重叠的最早时间
        if (willOverlapAt(adjustedScheduleMs)) {
          // 估算需要等待的时间：使前车尾部越过安全阈值
          // 采用线性探测，步长与速度成比例，最多探测到 maxProbeMs
          const stepMs = Math.max(30, Math.round((newTextWidth * 0.5) / vEffPxPerMs));
          let probe = adjustedScheduleMs + stepMs;
          while (probe <= maxProbeMs && willOverlapAt(probe)) probe += stepMs;
          adjustedScheduleMs = probe;
        }

        if (adjustedScheduleMs < bestScheduleMs) {
          bestChoice = i;
          bestScheduleMs = adjustedScheduleMs;
        }
      }

      if (bestChoice !== -1 && bestScheduleMs - tMs < 6000) {
        const finalScheduleMs = bestScheduleMs;
        const nextAvailableMs = finalScheduleMs + deltaCurrMs;

        scrollLaneNextAvailableRef.current[bestChoice] = nextAvailableMs;

        return {
          rowIndex: bestChoice,
          nextAvailableMs,
          scheduledMs: finalScheduleMs,
        };
      }

      return null;
    },
    [
      ensureLanes,
      layout.scrollRows,
      estimateTextWidth,
      computeEffectiveSpeed,
      width,
      active,
      lineHeight,
    ],
  );

  const pickTopRow = useCallback(
    (tMs: number): { rowIndex: number; nextAvailableMs: number; scheduledMs: number } | null => {
      ensureLanes();
      const deltaMs = 4000;

      const activeBulletsInTopRows = active.filter(
        (b) =>
          b.mode === DANDAN_COMMENT_MODE.Top && b.top >= 0 && b.top < layout.topRows * lineHeight,
      );

      let chosen = -1;
      for (let i = 0; i < layout.topRows; i++) {
        const avail = topLaneNextAvailableRef.current[i] ?? 0;
        const rowTop = i * lineHeight;

        const hasActiveBulletInRow = activeBulletsInTopRows.some(
          (b) => Math.abs(b.top - rowTop) < lineHeight / 2,
        );

        if (avail <= tMs && !hasActiveBulletInRow) {
          chosen = i;
          break;
        }
      }

      if (chosen !== -1) {
        const nextAvailableMs = tMs + deltaMs;
        topLaneNextAvailableRef.current[chosen] = nextAvailableMs;
        return { rowIndex: chosen, nextAvailableMs, scheduledMs: tMs };
      }

      return null;
    },
    [ensureLanes, layout.topRows, active, lineHeight],
  );

  const pickBottomRow = useCallback(
    (tMs: number): { rowIndex: number; nextAvailableMs: number; scheduledMs: number } | null => {
      ensureLanes();
      const deltaMs = 4000;

      const activeBulletsInBottomRows = active.filter((b) => b.mode === DANDAN_COMMENT_MODE.Bottom);

      let chosen = -1;
      for (let i = layout.bottomRows - 1; i >= 0; i--) {
        const avail = bottomLaneNextAvailableRef.current[i] ?? 0;
        const bottomStart = height * heightRatio - lineHeight;
        const rowTop = bottomStart - (layout.bottomRows - 1 - i) * lineHeight;

        const hasActiveBulletInRow = activeBulletsInBottomRows.some(
          (b) => Math.abs(b.top - rowTop) < lineHeight / 2,
        );

        if (avail <= tMs && !hasActiveBulletInRow) {
          chosen = i;
          break;
        }
      }

      if (chosen !== -1) {
        const nextAvailableMs = tMs + deltaMs;
        bottomLaneNextAvailableRef.current[chosen] = nextAvailableMs;
        return { rowIndex: chosen, nextAvailableMs, scheduledMs: tMs };
      }

      return null;
    },
    [ensureLanes, layout.bottomRows, active, height, heightRatio, lineHeight],
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
        playbackRate,
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
      playbackRate,
      fontSize,
    ],
  );

  const timedComments = useMemo(
    () =>
      filteredComments
        .map((comment) => ({
          comment,
          timeMs: Math.round(comment.timeInSeconds * 1000),
        }))
        .sort((a, b) => a.timeMs - b.timeMs),
    [filteredComments],
  );

  useEffect(() => {
    processedCommentsRef.current.clear();
    nextCommentIndexRef.current = findFirstTimedCommentAtOrAfter(
      timedComments,
      Math.max(0, lastTimeMsRef.current),
    );
  }, [timedComments]);

  useEffect(() => {
    sync(videoTime);
  }, [sync, videoTime]);

  useEffect(() => {
    if (!isPlaying) return;
    if (currentTimeMs === lastTimeMsRef.current) return;
    const prevMs = lastTimeMsRef.current;
    lastTimeMsRef.current = currentTimeMs;

    const fromMs = Math.min(prevMs, currentTimeMs);
    const toMs = Math.max(prevMs, currentTimeMs);

    const maxTimeDiff = 5000; // 最多显示前后5秒的弹幕
    const windowStartMs = Math.max(fromMs, currentTimeMs - maxTimeDiff);
    const shouldResetCursor = prevMs < 0 || currentTimeMs < prevMs || toMs - fromMs > 300;
    const lowerBoundIndex = findFirstTimedCommentAtOrAfter(timedComments, windowStartMs);
    let nextIndex = shouldResetCursor
      ? lowerBoundIndex
      : Math.max(nextCommentIndexRef.current, lowerBoundIndex);
    const slice: DandanComment[] = [];

    while (nextIndex < timedComments.length) {
      const { comment, timeMs: tMs } = timedComments[nextIndex];
      if (tMs > toMs) break;

      const timeDiff = Math.abs(tMs - currentTimeMs);
      if (
        tMs > fromMs &&
        timeDiff <= maxTimeDiff &&
        !processedCommentsRef.current.has(comment.id)
      ) {
        slice.push(comment);
      }

      nextIndex++;
    }

    nextCommentIndexRef.current = nextIndex;

    if (slice.length === 0) return;

    const windowMs = toMs - fromMs;
    const nextActiveBullets: ActiveBullet[] = [];

    if (windowMs > 300) {
      for (const c of slice) {
        const tMs = Math.round(c.timeInSeconds * 1000);
        if (processedCommentsRef.current.has(c.id)) {
          continue;
        }

        let pickRowFn: (
          tMs: number,
          text: string,
        ) => { rowIndex: number; nextAvailableMs: number; scheduledMs: number } | null;
        let updateLaneFn: (rowIndex: number, nextAvailableMs: number) => void;

        switch (c.mode) {
          case DANDAN_COMMENT_MODE.Top:
            pickRowFn = pickTopRow;
            updateLaneFn = (rowIndex, nextAvailableMs) => {
              topLaneNextAvailableRef.current[rowIndex] = nextAvailableMs;
            };
            break;
          case DANDAN_COMMENT_MODE.Bottom:
            pickRowFn = pickBottomRow;
            updateLaneFn = (rowIndex, nextAvailableMs) => {
              bottomLaneNextAvailableRef.current[rowIndex] = nextAvailableMs;
            };
            break;
          case DANDAN_COMMENT_MODE.Scroll:
          case DANDAN_COMMENT_MODE.ScrollBottom:
            pickRowFn = pickScrollRow;
            updateLaneFn = (rowIndex, nextAvailableMs) => {
              scrollLaneNextAvailableRef.current[rowIndex] = nextAvailableMs;
            };
            break;
          default:
            continue;
        }

        const picked = pickRowFn(tMs, c.text);
        if (picked) {
          const { rowIndex, nextAvailableMs, scheduledMs } = picked;
          updateLaneFn(rowIndex, nextAvailableMs);

          if (scheduledMs === tMs) {
            const lateOffset = Math.max(0, toMs - scheduledMs);
            const maxOffset =
              c.mode === DANDAN_COMMENT_MODE.Top || c.mode === DANDAN_COMMENT_MODE.Bottom
                ? Math.max(0, Math.round(3700 / Math.max(0.25, playbackRate)))
                : Math.max(
                    0,
                    Math.max(
                      4000,
                      Math.round(
                        ((width + estimateTextWidth(c.text) + 300) /
                          Math.max(1, speed * Math.max(0.25, playbackRate))) *
                          1000,
                      ),
                    ) - 300,
                  );
            const startOffsetMs = Math.min(lateOffset, maxOffset);

            const bullet = createDanmakuBullet(c, rowIndex, startOffsetMs, scheduledMs);
            nextActiveBullets.push(bullet);
            processedCommentsRef.current.add(c.id);
          } else {
            const bullet = createDanmakuBullet(c, rowIndex, 0, scheduledMs);
            nextActiveBullets.push(bullet);
            processedCommentsRef.current.add(c.id);
          }
        }
      }
    } else {
      for (const c of slice) {
        const tMs = Math.round(c.timeInSeconds * 1000);
        if (processedCommentsRef.current.has(c.id)) {
          continue;
        }

        if (!isPlaying) return;

        let pickRowFn: (
          tMs: number,
          text: string,
        ) => { rowIndex: number; nextAvailableMs: number; scheduledMs: number } | null;

        switch (c.mode) {
          case DANDAN_COMMENT_MODE.Top:
            pickRowFn = pickTopRow;
            break;
          case DANDAN_COMMENT_MODE.Bottom:
            pickRowFn = pickBottomRow;
            break;
          case DANDAN_COMMENT_MODE.Scroll:
          case DANDAN_COMMENT_MODE.ScrollBottom:
            pickRowFn = pickScrollRow;
            break;
          default:
            return;
        }

        const picked = pickRowFn(tMs, c.text);
        if (picked) {
          const { rowIndex, scheduledMs } = picked;
          const extraDelay = Math.max(0, scheduledMs - tMs);

          if (extraDelay === 0) {
            const bullet = createDanmakuBullet(c, rowIndex, 0, tMs);
            nextActiveBullets.push(bullet);
            processedCommentsRef.current.add(c.id);
          } else {
            const bullet = createDanmakuBullet(c, rowIndex, 0, tMs + extraDelay);
            nextActiveBullets.push(bullet);
            processedCommentsRef.current.add(c.id);
          }
        }
      }
    }

    if (nextActiveBullets.length > 0) {
      setActive((prev) => [...prev, ...nextActiveBullets]);
    }
  }, [
    currentTimeMs,
    isPlaying,
    timedComments,
    rows,
    layout,
    height,
    width,
    speed,
    lineHeight,
    heightRatio,
    active,
    ensureLanes,
    pickTopRow,
    pickBottomRow,
    pickScrollRow,
    createDanmakuBullet,
    estimateTextWidth,
    playbackRate,
  ]);

  useEffect(() => {
    const processedComments = processedCommentsRef.current;
    return () => {
      processedComments.clear();
    };
  }, []);

  const handleExpire = useCallback((id: number) => {
    setActive((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const effectiveOpacity = danmakuFilter === 15 ? 0 : opacity;

  return (
    <View
      style={[StyleSheet.absoluteFill, { opacity: effectiveOpacity, overflow: 'hidden' }]}
      pointerEvents="none"
    >
      {active.map((b) => (
        <MemoBullet
          key={b.id}
          width={width}
          data={b}
          onExpire={handleExpire}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
        />
      ))}
    </View>
  );
}

const MemoBullet = React.memo(Bullet);

export default DanmakuLayer;
