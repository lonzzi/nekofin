import { DandanCommentMode } from '@/services/dandanplay';
import { TextStyle } from 'react-native';

export type ActiveBullet = {
  id: number;
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
