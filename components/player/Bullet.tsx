import { StrokeTextView } from '@/modules/stroke-text';
import { DANDAN_COMMENT_MODE } from '@/services/dandanplay';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, TextStyle } from 'react-native';

import { ActiveBullet } from './DanmakuTypes';

const STROKE_COLOR = '#000';
const STROKE_WIDTH = 1.8;

export function Bullet({
  width,
  data,
  onExpire,
  fontSize,
  fontFamily,
  fontWeight,
  isPlaying,
  playbackRate,
}: {
  width: number;
  data: ActiveBullet;
  onExpire: (id: number) => void;
  fontSize: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
  isPlaying: boolean;
  playbackRate: number;
}) {
  const initTranslateX = useMemo(() => {
    const isLeftScroll = data.mode === DANDAN_COMMENT_MODE.Scroll;
    const clampedOffset = Math.max(0, Math.min(data.startOffsetMs || 0, data.durationMs));
    const totalDistance = isLeftScroll
      ? -(width + (data.textWidth || 0) + 300)
      : width + (data.textWidth || 0) + 300;
    const progressed = Math.max(0, Math.min(1, clampedOffset / data.durationMs));
    return totalDistance * progressed;
  }, [data.mode, data.startOffsetMs, data.durationMs, width, data.textWidth]);

  const translateX = useRef(new Animated.Value(initTranslateX)).current;

  const originalDurationRef = useRef<number>(data.durationMs);
  const remainingDurationRef = useRef<number>(data.durationMs);
  const runStartedAtRef = useRef<number | null>(null);
  const removeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRateRef = useRef<number>(playbackRate);

  useEffect(() => {
    originalDurationRef.current = data.durationMs;
    const clampedOffset = Math.max(0, Math.min(data.startOffsetMs || 0, data.durationMs));
    remainingDurationRef.current = Math.max(0, data.durationMs - clampedOffset);
  }, [data.durationMs, data.startOffsetMs, data.mode, width, translateX]);

  const handleExpire = useCallback(() => {
    onExpire(data.id);
  }, [data.id, onExpire]);

  const scheduleFadeAndRemoval = useCallback(() => {
    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

    if (remainingDurationRef.current > 0) {
      removeTimeoutRef.current = setTimeout(() => {
        handleExpire();
      }, remainingDurationRef.current);
    } else {
      handleExpire();
    }
  }, [handleExpire]);

  const startOrResume = useCallback(() => {
    if (runStartedAtRef.current != null) return;
    runStartedAtRef.current = Date.now();
    scheduleFadeAndRemoval();

    if (
      data.mode === DANDAN_COMMENT_MODE.Scroll ||
      data.mode === DANDAN_COMMENT_MODE.ScrollBottom
    ) {
      const isLeftScroll = data.mode === DANDAN_COMMENT_MODE.Scroll;
      // 长弹幕需要更大的移动距离，确保完全离开屏幕
      const totalDistance = isLeftScroll
        ? -(width + (data.textWidth || 0) + 300)
        : width + (data.textWidth || 0) + 300;
      const remaining = remainingDurationRef.current;

      if (remaining <= 0) {
        handleExpire();
        return;
      }

      Animated.timing(translateX, {
        toValue: totalDistance,
        duration: Math.max(0, remaining),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }
  }, [scheduleFadeAndRemoval, data.mode, data.textWidth, width, translateX, handleExpire]);

  const pauseRun = useCallback(() => {
    if (runStartedAtRef.current == null) return;
    const elapsed = Date.now() - runStartedAtRef.current;
    runStartedAtRef.current = null;

    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

    remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed);

    translateX.stopAnimation();
  }, [translateX]);

  useEffect(() => {
    if (isPlaying) {
      startOrResume();
    } else {
      pauseRun();
    }
    return () => {
      if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
    };
  }, [isPlaying, startOrResume, pauseRun, translateX]);

  useEffect(() => {
    const oldRate = Math.max(0.25, prevRateRef.current || 1);
    const newRate = Math.max(0.25, playbackRate || 1);
    if (oldRate === newRate) return;

    const scale = oldRate / newRate;

    if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

    if (runStartedAtRef.current != null) {
      const elapsed = Date.now() - runStartedAtRef.current;
      runStartedAtRef.current = null;
      remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed);
    }

    remainingDurationRef.current = Math.max(0, Math.round(remainingDurationRef.current * scale));

    // 对滚动弹幕重启动画使其以新时长完成剩余距离
    if (
      data.mode === DANDAN_COMMENT_MODE.Scroll ||
      data.mode === DANDAN_COMMENT_MODE.ScrollBottom
    ) {
      translateX.stopAnimation((currentX) => {
        const isLeftScroll = data.mode === DANDAN_COMMENT_MODE.Scroll;
        const totalDistance = isLeftScroll
          ? -(width + (data.textWidth || 0) + 300)
          : width + (data.textWidth || 0) + 300;

        const remaining = remainingDurationRef.current;
        if (remaining <= 0) {
          handleExpire();
          return;
        }

        // 重新启动计时与移除调度
        runStartedAtRef.current = Date.now();
        scheduleFadeAndRemoval();

        // 从当前位移到目标位移，耗时为缩放后的剩余时间
        Animated.timing(translateX, {
          toValue: totalDistance,
          duration: Math.max(0, remaining),
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
      });
    } else {
      runStartedAtRef.current = Date.now();
      scheduleFadeAndRemoval();
    }

    prevRateRef.current = newRate;
  }, [
    playbackRate,
    data.mode,
    data.textWidth,
    width,
    translateX,
    handleExpire,
    scheduleFadeAndRemoval,
  ]);

  const style = useMemo(
    () => ({
      position: 'absolute' as const,
      top: data.top,
      left:
        data.mode === DANDAN_COMMENT_MODE.Scroll
          ? width
          : data.mode === DANDAN_COMMENT_MODE.ScrollBottom
            ? -100
            : 0,
      transform:
        data.mode === DANDAN_COMMENT_MODE.Scroll || data.mode === DANDAN_COMMENT_MODE.ScrollBottom
          ? [{ translateX }]
          : [],
    }),
    [data.top, data.mode, width, translateX],
  );

  const isTopOrBottom =
    data.mode === DANDAN_COMMENT_MODE.Top || data.mode === DANDAN_COMMENT_MODE.Bottom;

  return (
    <Animated.View style={[style, { width: '100%' }]} renderToHardwareTextureAndroid>
      <StrokeTextView
        text={data.text}
        color={data.colorHex}
        strokeColor={STROKE_COLOR}
        strokeWidth={STROKE_WIDTH}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily={fontFamily}
        textAlign={isTopOrBottom ? 'center' : 'left'}
      />
    </Animated.View>
  );
}
