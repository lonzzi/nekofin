import { DANDAN_COMMENT_MODE, DandanComment } from '@/services/dandanplay';

import { ActiveBullet } from './DanmakuTypes';

export interface DanmakuLayout {
  topRows: number;
  bottomRows: number;
  scrollRows: number;
}

export interface DanmakuRuntimeLayout {
  height: number;
  heightRatio: number;
  lineHeight: number;
  layout: DanmakuLayout;
  playbackRate: number;
  speed: number;
  width: number;
}

export const removeActiveDanmakuBullet = (
  bullets: ActiveBullet[],
  instanceId: number,
): ActiveBullet[] => bullets.filter((bullet) => bullet.instanceId !== instanceId);

export const calculateDanmakuRows = ({
  height,
  heightRatio,
  lineHeight,
  density,
}: {
  height: number;
  heightRatio: number;
  lineHeight: number;
  density: number;
}) =>
  Math.max(
    1,
    Math.floor(
      ((Math.max(0, height) * Math.max(0, heightRatio)) / Math.max(1, lineHeight)) *
        Math.max(0.1, density),
    ),
  );

export const calculateDanmakuLayout = (rows: number): DanmakuLayout => ({
  topRows: Math.max(1, Math.floor(rows * 1)),
  bottomRows: Math.max(1, Math.floor(rows * 1)),
  scrollRows: Math.max(1, rows),
});

export const estimateDanmakuTextWidth = ({
  text,
  fontSize,
}: {
  text: string;
  fontSize: number;
}): number => {
  let emWidth = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;

    // Joiners, variation selectors, and combining marks do not add an advance
    // of their own. Emoji/CJK/full-width glyphs are conservatively one em.
    if (
      codePoint === 0x200d ||
      (codePoint >= 0x0300 && codePoint <= 0x036f) ||
      (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
      (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
    ) {
      continue;
    }

    if (/\s/u.test(character)) {
      emWidth += 0.35;
    } else if (
      (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60) ||
      (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    ) {
      emWidth += 1;
    } else if (/[MWmw@#%&]/u.test(character)) {
      // Wide Latin glyphs are close to one em in the system bold font. The old
      // blanket 0.6 em estimate made right-moving comments visibly flash in.
      emWidth += 1;
    } else if (/[A-Z0-9]/u.test(character)) {
      emWidth += 0.75;
    } else if (/[a-z]/u.test(character)) {
      emWidth += 0.65;
    } else {
      emWidth += 0.75;
    }
  }

  return Math.ceil(emWidth * fontSize + 16);
};

export const calculateDefaultDanmakuDuration = (playbackRate: number): number =>
  Math.max(800, Math.round(4000 / Math.max(0.25, playbackRate)));

export const calculateEffectiveScrollSpeed = ({
  textWidth,
  speed,
  width,
  playbackRate,
}: {
  textWidth: number;
  speed: number;
  width: number;
  playbackRate: number;
}): number => {
  const base = Math.max(50, speed);
  const ratio = Math.min(2, Math.max(0, textWidth / Math.max(1, width)));
  const factor = 1 + 0.4 * ratio;
  return Math.min(base * factor * Math.max(0.25, playbackRate), 900);
};

export const calculateScrollDurationMs = ({
  width,
  textWidth,
  speed,
}: {
  width: number;
  textWidth: number;
  speed: number;
}): number => {
  const totalDistance = width + textWidth + 300;
  return Math.max(3000, Math.round((totalDistance / Math.max(1, speed)) * 1000));
};

export const calculateDanmakuScrollTrajectory = ({
  mode,
  progress,
  textWidth,
  width,
}: {
  mode: DandanComment['mode'];
  progress: number;
  textWidth: number;
  width: number;
}) => {
  const safeTextWidth = Math.max(0, textWidth);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const startX = mode === DANDAN_COMMENT_MODE.Scroll ? width : -safeTextWidth;
  const endX = mode === DANDAN_COMMENT_MODE.Scroll ? -safeTextWidth - 300 : width + 300;
  const left = startX + (endX - startX) * clampedProgress;
  return {
    endX,
    left,
    right: left + safeTextWidth,
    startX,
    totalDistance: Math.abs(endX - startX),
  };
};

export const getDanmakuBulletTop = ({
  mode,
  rowIndex,
  lineHeight,
  height,
  heightRatio,
  bottomRows,
}: {
  mode: DandanComment['mode'];
  rowIndex: number;
  lineHeight: number;
  height: number;
  heightRatio: number;
  bottomRows: number;
}): number => {
  if (mode === DANDAN_COMMENT_MODE.Bottom) {
    const safeLineHeight = Math.max(1, lineHeight);
    const visibleRows = Math.max(
      1,
      Math.floor((Math.max(0, height) * Math.max(0, heightRatio)) / safeLineHeight),
    );
    const usableBottomRows = Math.min(Math.max(1, bottomRows), visibleRows);
    const firstVisualRow = visibleRows - usableBottomRows;
    const safeRowIndex = Math.min(Math.max(0, rowIndex), usableBottomRows - 1);
    return (firstVisualRow + safeRowIndex) * safeLineHeight;
  }

  return rowIndex * lineHeight;
};

/**
 * Maps a line-height-tall bullet onto every visual grid row it intersects.
 * Bottom-fixed rows can start on a fractional grid boundary when the visible
 * height is not divisible by lineHeight, so rounding to one row is unsafe.
 */
export const getDanmakuOccupiedVisualRows = ({
  lineHeight,
  top,
}: {
  lineHeight: number;
  top: number;
}): number[] => {
  if (!Number.isFinite(lineHeight) || lineHeight <= 0 || !Number.isFinite(top)) return [];

  const safeTop = Math.max(0, top);
  const firstRow = Math.floor(safeTop / lineHeight);
  const endExclusive = safeTop + lineHeight;
  const lastRow = Math.max(firstRow, Math.ceil(endExclusive / lineHeight - Number.EPSILON) - 1);

  if (firstRow === lastRow) return [firstRow];
  return [firstRow, lastRow];
};

export const createActiveDanmakuBullet = ({
  comment,
  instanceId,
  rowIndex,
  startOffsetMs = 0,
  scheduledMs = 0,
  textWidth,
  runtime,
}: {
  comment: DandanComment;
  instanceId: number;
  rowIndex: number;
  startOffsetMs?: number;
  scheduledMs?: number;
  textWidth: number;
  runtime: DanmakuRuntimeLayout;
}): ActiveBullet => {
  const defaultDurationMs = calculateDefaultDanmakuDuration(runtime.playbackRate);
  const baseParams = {
    commentId: comment.id,
    instanceId,
    text: comment.text,
    colorHex: comment.colorHex,
    mode: comment.mode,
    startOffsetMs,
    scheduledMs,
    textWidth,
  };

  if (
    comment.mode === DANDAN_COMMENT_MODE.Scroll ||
    comment.mode === DANDAN_COMMENT_MODE.ScrollBottom
  ) {
    const effectiveSpeed = calculateEffectiveScrollSpeed({
      textWidth,
      speed: runtime.speed,
      width: runtime.width,
      playbackRate: runtime.playbackRate,
    });

    const durationMs = calculateScrollDurationMs({
      width: runtime.width,
      textWidth,
      speed: effectiveSpeed,
    });

    return {
      ...baseParams,
      top: getDanmakuBulletTop({
        mode: comment.mode,
        rowIndex,
        lineHeight: runtime.lineHeight,
        height: runtime.height,
        heightRatio: runtime.heightRatio,
        bottomRows: runtime.layout.bottomRows,
      }),
      durationMs,
      mediaDurationMs: durationMs * Math.max(0.25, runtime.playbackRate),
    };
  }

  return {
    ...baseParams,
    top: getDanmakuBulletTop({
      mode: comment.mode,
      rowIndex,
      lineHeight: runtime.lineHeight,
      height: runtime.height,
      heightRatio: runtime.heightRatio,
      bottomRows: runtime.layout.bottomRows,
    }),
    durationMs: defaultDurationMs,
    mediaDurationMs: defaultDurationMs * Math.max(0.25, runtime.playbackRate),
  };
};
