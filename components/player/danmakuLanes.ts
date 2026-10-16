import { DANDAN_COMMENT_MODE, type DandanCommentMode } from '@/services/dandanplay';

import {
  DANMAKU_SCROLL_DIRECTION,
  isDanmakuLaneBlockedAtTime,
  isScrollingDanmakuEntrySafe,
  selectDanmakuFallbackLane,
} from './danmakuCollision';
import {
  calculateDanmakuScrollTrajectory,
  getDanmakuBulletTop,
  getDanmakuOccupiedVisualRows,
  type DanmakuRuntimeLayout,
} from './danmakuLayout';
import type { ActiveBullet, DanmakuSettingsType } from './DanmakuTypes';

/** Each mode owns its rows, including a separate pool for reverse scrolling. */
export type DanmakuLaneOccupancy = Map<DandanCommentMode, Map<number, ActiveBullet[]>>;

export function addDanmakuLaneBullet(
  occupancy: DanmakuLaneOccupancy,
  bullet: ActiveBullet,
  lineHeight: number,
): void {
  let modeRows = occupancy.get(bullet.mode);
  if (!modeRows) {
    modeRows = new Map();
    occupancy.set(bullet.mode, modeRows);
  }
  for (const row of getDanmakuOccupiedVisualRows({ lineHeight, top: bullet.top })) {
    const rowBullets = modeRows.get(row);
    if (rowBullets) rowBullets.push(bullet);
    else modeRows.set(row, [bullet]);
  }
}

export function createDanmakuLaneOccupancy(
  bullets: ActiveBullet[],
  lineHeight: number,
): DanmakuLaneOccupancy {
  const occupancy: DanmakuLaneOccupancy = new Map();
  for (const bullet of bullets) addDanmakuLaneBullet(occupancy, bullet, lineHeight);
  return occupancy;
}

export function pickDanmakuLane({
  bullet,
  collisionPolicy,
  occupancy,
  rowMinGapPx,
  runtime,
}: {
  bullet: ActiveBullet;
  collisionPolicy: DanmakuSettingsType['collisionPolicy'];
  occupancy: DanmakuLaneOccupancy;
  rowMinGapPx: number;
  runtime: DanmakuRuntimeLayout;
}): { rowIndex: number; top: number } | null {
  const { mode, scheduledMs, textWidth } = bullet;
  const { height, heightRatio, layout, lineHeight, width } = runtime;
  const isScroll = mode === DANDAN_COMMENT_MODE.Scroll || mode === DANDAN_COMMENT_MODE.ScrollBottom;
  if (!isScroll && mode !== DANDAN_COMMENT_MODE.Top && mode !== DANDAN_COMMENT_MODE.Bottom) {
    return null;
  }
  const rows = isScroll
    ? layout.scrollRows
    : mode === DANDAN_COMMENT_MODE.Top
      ? layout.topRows
      : layout.bottomRows;
  const modeRows = occupancy.get(mode);
  const direction =
    mode === DANDAN_COMMENT_MODE.Scroll
      ? DANMAKU_SCROLL_DIRECTION.RightToLeft
      : DANMAKU_SCROLL_DIRECTION.LeftToRight;
  const incomingVelocity = isScroll
    ? calculateDanmakuScrollTrajectory({ mode, progress: 0, textWidth, width }).totalDistance /
      bullet.mediaDurationMs
    : 0;
  const requiredGapBase = Math.max(rowMinGapPx, 8, textWidth * 0.05);
  const fallbackCandidates: {
    activeCount: number;
    availableAtMs: number;
    rowIndex: number;
    top: number;
  }[] = [];

  for (let index = 0; index < rows; index++) {
    const rowIndex = mode === DANDAN_COMMENT_MODE.Bottom ? rows - index - 1 : index;
    const top = getDanmakuBulletTop({
      mode,
      rowIndex,
      lineHeight,
      height,
      heightRatio,
      bottomRows: layout.bottomRows,
    });
    const occupiedRows = getDanmakuOccupiedVisualRows({ lineHeight, top });
    const rowBullets = new Set(occupiedRows.flatMap((row) => modeRows?.get(row) ?? []));
    const activeInRow = [...rowBullets].filter((previous) =>
      isDanmakuLaneBlockedAtTime({
        atTimeMs: scheduledMs,
        mediaDurationMs: previous.visibleMediaDurationMs,
        scheduledMs: previous.scheduledMs,
      }),
    );

    if (
      activeInRow.every((previous) => {
        if (!isScroll) return false;
        const progress = Math.max(
          0,
          Math.min(1, (scheduledMs - previous.scheduledMs) / previous.mediaDurationMs),
        );
        const trajectory = calculateDanmakuScrollTrajectory({
          mode,
          progress,
          textWidth: previous.textWidth,
          width,
        });
        return isScrollingDanmakuEntrySafe({
          previous: {
            direction,
            leftPx: trajectory.left,
            speedPxPerMediaMs: trajectory.totalDistance / previous.mediaDurationMs,
            widthPx: previous.textWidth,
          },
          incoming: { direction, speedPxPerMediaMs: incomingVelocity },
          safeSeparationPx: Math.max(requiredGapBase, previous.textWidth * 0.15),
          viewportWidthPx: width,
        });
      })
    ) {
      return { rowIndex, top };
    }

    fallbackCandidates.push({
      activeCount: activeInRow.length,
      availableAtMs: Math.max(
        scheduledMs,
        ...activeInRow.map((previous) => previous.scheduledMs + previous.visibleMediaDurationMs),
      ),
      rowIndex,
      top,
    });
  }

  if (collisionPolicy === 'allow') return selectDanmakuFallbackLane(fallbackCandidates);
  return null;
}
