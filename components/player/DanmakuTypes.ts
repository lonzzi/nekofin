import { DandanCommentMode } from '@/services/dandanplay';
import { TextStyle } from 'react-native';

export type ActiveBullet = {
  commentId: number;
  instanceId: number;
  text: string;
  colorHex: string;
  top: number;
  durationMs: number;
  mode: DandanCommentMode;
  startOffsetMs: number;
  scheduledMs: number;
  textWidth: number;
};

export type DanmakuSettingsType = {
  enabled: boolean;
  opacity: number;
  speed: number;
  fontSize: number;
  heightRatio: number;
  danmakuFilter: number;
  danmakuModeFilter: number;
  danmakuDensityLimit: number;
  curEpOffset: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
};
