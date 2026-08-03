import { StrokeTextView } from '@/modules/stroke-text';
import { DANDAN_COMMENT_MODE } from '@/services/dandanplay';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { calculateDanmakuScrollTrajectory } from './danmakuLayout';
import { ActiveBullet } from './DanmakuTypes';

const STROKE_COLOR = '#000';
const STROKE_WIDTH = 1.6;

export function Bullet({
  width,
  data,
  fontSize,
  fontFamily,
  fontWeight,
  isPlaying,
  playbackRate,
}: {
  width: number;
  data: ActiveBullet;
  fontSize: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
  isPlaying: boolean;
  playbackRate: number;
}) {
  const isScroll = useMemo(
    () =>
      data.mode === DANDAN_COMMENT_MODE.Scroll || data.mode === DANDAN_COMMENT_MODE.ScrollBottom,
    [data.mode],
  );

  const initTranslateX = useMemo(() => {
    if (isScroll) {
      const clampedOffset = Math.max(0, Math.min(data.startOffsetMs || 0, data.durationMs));
      const progressed = Math.max(0, Math.min(1, clampedOffset / data.durationMs));

      return calculateDanmakuScrollTrajectory({
        mode: data.mode,
        progress: progressed,
        textWidth: data.textWidth || 0,
        width,
      }).left;
    } else {
      return 0;
    }
  }, [isScroll, data.startOffsetMs, data.durationMs, data.textWidth, width, data.mode]);

  const translateX = useSharedValue(initTranslateX);

  const remainingDurationRef = useRef<number>(data.durationMs);
  const runStartedAtRef = useRef<number | null>(null);
  const prevRateRef = useRef<number>(playbackRate);

  const isInitializedRef = useRef(false);

  useEffect(() => {
    const clampedOffset = Math.max(0, Math.min(data.startOffsetMs || 0, data.durationMs));
    remainingDurationRef.current = Math.max(0, data.durationMs - clampedOffset);

    if (!isInitializedRef.current) {
      translateX.set(initTranslateX);
      isInitializedRef.current = true;
    }
  }, [data.durationMs, data.startOffsetMs, translateX, initTranslateX]);

  const startOrResume = useCallback(() => {
    if (runStartedAtRef.current != null) return;
    const remaining = remainingDurationRef.current;
    if (remaining <= 0) return;

    runStartedAtRef.current = Date.now();

    if (isScroll) {
      const endX = calculateDanmakuScrollTrajectory({
        mode: data.mode,
        progress: 1,
        textWidth: data.textWidth || 0,
        width,
      }).endX;
      translateX.set(
        withTiming(endX, {
          duration: Math.max(100, remaining),
          easing: Easing.linear,
        }),
      );
    }
  }, [isScroll, data.mode, data.textWidth, width, translateX]);

  const pauseRun = useCallback(() => {
    if (runStartedAtRef.current == null) return;
    const elapsed = Date.now() - runStartedAtRef.current;
    runStartedAtRef.current = null;

    remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed);

    cancelAnimation(translateX);
  }, [translateX]);

  useEffect(() => {
    if (isPlaying) {
      startOrResume();
    } else {
      pauseRun();
    }
    return () => {
      pauseRun();
    };
  }, [isPlaying, startOrResume, pauseRun]);

  useEffect(() => {
    const oldRate = Math.max(0.25, prevRateRef.current || 1);
    const newRate = Math.max(0.25, playbackRate || 1);
    if (oldRate === newRate) return;

    const scale = oldRate / newRate;

    if (runStartedAtRef.current != null) {
      pauseRun();
    }

    remainingDurationRef.current = Math.max(0, Math.round(remainingDurationRef.current * scale));
    prevRateRef.current = newRate;

    if (isPlaying) startOrResume();
  }, [playbackRate, isPlaying, pauseRun, startOrResume]);

  const animatedStyle = useAnimatedStyle(() => {
    const shouldTranslate = isScroll;

    if (shouldTranslate) {
      return {
        position: 'absolute',
        top: data.top,
        left: 0,
        transform: [{ translateX: translateX.get() }],
      };
    } else {
      return {
        position: 'absolute',
        top: data.top,
        left: 0,
        transform: [],
      };
    }
  }, [data.top, isScroll]);

  const isTopOrBottom =
    data.mode === DANDAN_COMMENT_MODE.Top || data.mode === DANDAN_COMMENT_MODE.Bottom;
  const bulletWidth = isTopOrBottom ? width : Math.max(width, data.textWidth);

  return (
    <Animated.View style={[animatedStyle, { width: bulletWidth }]} renderToHardwareTextureAndroid>
      <StrokeTextView
        text={data.text}
        color={data.colorHex}
        strokeColor={STROKE_COLOR}
        strokeWidth={STROKE_WIDTH}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily={fontFamily}
        lineHeight={fontSize + 8}
        numberOfLines={1}
        textAlign={isTopOrBottom ? 'center' : 'left'}
      />
    </Animated.View>
  );
}
