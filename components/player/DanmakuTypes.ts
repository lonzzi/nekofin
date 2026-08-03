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
  mode: DandanCommentMode;
  startOffsetMs: number;
  scheduledMs: number;
  textWidth: number;
};
