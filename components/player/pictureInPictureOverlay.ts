import type { DanmakuSettingsType } from '@/lib/contexts/DanmakuSettingsContext';
import { DANDAN_COMMENT_MODE, type DandanComment } from '@/services/dandanplay';
import type { PictureInPictureOverlay } from 'expo-mpv';

import { calculateDanmakuActiveHardLimit } from './danmakuCollision';
import { filterDanmakuComments } from './danmakuFilters';
import { createDanmakuLaneOccupancy, pickDanmakuLane } from './danmakuLanes';
import {
  calculateDanmakuLayout,
  calculateDanmakuRows,
  calculateDanmakuScrollTrajectory,
  createActiveDanmakuBullet,
  estimateDanmakuTextWidth,
} from './danmakuLayout';
import { prepareDanmakuTimeline, removeExpiredDanmakuEntries } from './danmakuScheduler';
import type { ActiveBullet } from './DanmakuTypes';

/** Precompute media-time cues once; Android draws them without JS timers in PiP.
 * A fixed canvas keeps the timeline stable across Activity/window resizes.
 */
export function createPictureInPictureOverlay(
  comments: DandanComment[],
  settings: DanmakuSettingsType,
): PictureInPictureOverlay | null {
  if (!settings.enabled || settings.danmakuFilter === 15 || !comments.length) return null;
  const width = 384;
  const height = 216;
  const { fontSize, heightRatio, speed, opacity } = settings;
  const lineHeight = fontSize + 8;
  const layout = calculateDanmakuLayout(
    calculateDanmakuRows({ height, heightRatio, lineHeight, density: 1 }),
  );
  // Durations are media time, so the native mpv clock handles playback speed,
  // pause/buffering, and seeking without regenerating the entire track.
  const runtime = { width, height, heightRatio, lineHeight, layout, speed, playbackRate: 1 };
  const density = Math.max(0, Math.min(4, Math.trunc(settings.danmakuDensityLimit)));
  const activeLimit = calculateDanmakuActiveHardLimit(layout.scrollRows, density);
  const timeline = prepareDanmakuTimeline(
    filterDanmakuComments(comments, { ...settings, width, height }),
  );
  const cues: PictureInPictureOverlay['cues'] = [];
  let active: ActiveBullet[] = [];
  for (const { comment, timeMs, sourceIndex } of timeline) {
    if (!comment.text.trim()) continue;
    active = removeExpiredDanmakuEntries(active, timeMs);
    if (active.length >= activeLimit) continue;
    const textWidth = estimateDanmakuTextWidth({ text: comment.text, fontSize });
    const bullet = createActiveDanmakuBullet({
      comment,
      instanceId: sourceIndex,
      rowIndex: 0,
      scheduledMs: timeMs,
      textWidth,
      runtime,
    });
    const lane = pickDanmakuLane({
      bullet,
      collisionPolicy: settings.collisionPolicy,
      occupancy: createDanmakuLaneOccupancy(active, lineHeight),
      rowMinGapPx: [40, 24, 40, 56, 72][density],
      runtime,
    });
    if (!lane) continue;
    active.push({ ...bullet, top: lane.top });
    const scrolling =
      comment.mode === DANDAN_COMMENT_MODE.Scroll ||
      comment.mode === DANDAN_COMMENT_MODE.ScrollBottom;
    const trajectory = calculateDanmakuScrollTrajectory({
      mode: comment.mode,
      progress: 0,
      textWidth,
      width,
    });
    cues.push({
      start: timeMs / 1000,
      end: (timeMs + bullet.mediaDurationMs) / 1000,
      text: comment.text,
      color: comment.colorHex,
      startX: scrolling ? trajectory.startX : (width - textWidth) / 2,
      endX: scrolling ? trajectory.endX : (width - textWidth) / 2,
      y: lane.top,
    });
  }
  return { width, height, fontSize, opacity, cues };
}
