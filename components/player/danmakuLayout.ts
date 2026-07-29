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
}) => Math.max(6, Math.floor(((height * heightRatio) / lineHeight) * density));

export const calculateDanmakuLayout = (rows: number): DanmakuLayout => ({
  topRows: Math.max(1, Math.floor(rows * 1)),
  bottomRows: Math.max(1, Math.floor(rows * 1)),
  scrollRows: Math.max(1, rows),
});

export const estimateDanmakuTextWidth = ({
  text,
  fontSize,
  containerWidth,
}: {
  text: string;
  fontSize: number;
  containerWidth: number;
}): number => {
  let cjkCount = 0;
  let otherCount = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (
      (ch >= 0x4e00 && ch <= 0x9fff) ||
      (ch >= 0x3400 && ch <= 0x4dbf) ||
      (ch >= 0x20000 && ch <= 0x2a6df)
    ) {
      cjkCount++;
    } else {
      otherCount++;
    }
  }

  const cjkWidth = cjkCount * fontSize;
  const otherWidth = otherCount * fontSize * 0.6;
  return Math.min(containerWidth * 2, cjkWidth + otherWidth + 16);
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
    const bottomStart = height * heightRatio - lineHeight;
    return bottomStart - (bottomRows - 1 - rowIndex) * lineHeight;
  }

  return rowIndex * lineHeight;
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
      durationMs: calculateScrollDurationMs({
        width: runtime.width,
        textWidth,
        speed: effectiveSpeed,
      }),
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
  };
};
