import { formatTimeWorklet } from '@/lib/utils/duration';

export type VerticalGestureMode = 'brightness' | 'volume';

export const PAN_ACTIVATION_DISTANCE = 28;

export const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.max(min, Math.min(max, value));
};

export const isHorizontalPan = (translationX: number, translationY: number) => {
  'worklet';

  return (
    Math.abs(translationX) >= PAN_ACTIVATION_DISTANCE &&
    Math.abs(translationX) > Math.abs(translationY) * 1.5
  );
};

export const isVerticalPan = (translationX: number, translationY: number) => {
  'worklet';

  return (
    Math.abs(translationY) >= PAN_ACTIVATION_DISTANCE &&
    Math.abs(translationY) > Math.abs(translationX) * 1.5
  );
};

export const calculateSeekGesture = ({
  translationX,
  screenWidth,
  duration,
  startTime,
}: {
  translationX: number;
  screenWidth: number;
  duration: number;
  startTime: number;
}) => {
  'worklet';

  const progressRatio = translationX / Math.max(1, screenWidth);
  const requestedTime = startTime + progressRatio * Math.min(90_000, duration);
  const time = clamp(requestedTime, 0, duration);

  return {
    offset: time - startTime,
    time,
  };
};

export const formatSeekOffsetText = (offsetMs: number) => {
  'worklet';

  const absoluteMs = Math.abs(offsetMs);
  const sign = absoluteMs < 1000 ? '' : offsetMs > 0 ? '+' : '-';
  return `${sign}${formatTimeWorklet(absoluteMs)}`;
};

export const getVerticalGestureMode = (x: number, screenWidth: number): VerticalGestureMode => {
  'worklet';

  return x < screenWidth * 0.5 ? 'brightness' : 'volume';
};

export const calculateVerticalGestureValue = ({
  translationY,
  screenHeight,
  startValue,
}: {
  translationY: number;
  screenHeight: number;
  startValue: number;
}) => {
  'worklet';

  const offset = -translationY / Math.max(480, screenHeight * 1.5);

  return {
    offset,
    value: clamp(startValue + offset, 0, 1),
  };
};
