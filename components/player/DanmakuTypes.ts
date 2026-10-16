import { DandanCommentMode } from '@/services/dandanplay';

export type { DanmakuSettingsType } from '@/lib/contexts/DanmakuSettingsContext';

export type ActiveBullet = {
  commentId: number;
  instanceId: number;
  text: string;
  colorHex: string;
  top: number;
  durationMs: number;
  mediaDurationMs: number;
  /** Media time until the text leaves the viewport, excluding animation overscan. */
  visibleMediaDurationMs: number;
  mode: DandanCommentMode;
  startOffsetMs: number;
  scheduledMs: number;
  textWidth: number;
};
