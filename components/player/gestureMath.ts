export type VerticalGestureMode = 'brightness' | 'volume';

export const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.max(min, Math.min(max, value));
};

export const isHorizontalPan = (translationX: number, translationY: number) => {
  'worklet';

  return Math.abs(translationX) > Math.abs(translationY) * 1.2;
};

export const isVerticalPan = (translationX: number, translationY: number) => {
  'worklet';

  return Math.abs(translationY) > Math.abs(translationX) * 1.2;
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

  const progressRatio = translationX / screenWidth;
  const offset = progressRatio * 180000;

  return {
    offset,
    time: clamp(startTime + offset, 0, duration),
  };
};

export const formatSeekOffsetText = (offsetMs: number) => {
  'worklet';

  const offsetSeconds = Math.round(offsetMs / 1000);
  return offsetSeconds > 0 ? `+${offsetSeconds}s` : `${offsetSeconds}s`;
};

export const getVerticalGestureMode = (x: number, screenWidth: number): VerticalGestureMode => {
  'worklet';

  return x < screenWidth * 0.5 ? 'brightness' : 'volume';
};

export const calculateVerticalGestureValue = ({
  translationY,
  screenWidth,
  startValue,
}: {
  translationY: number;
  screenWidth: number;
  startValue: number;
}) => {
  'worklet';

  const progressRatio = -translationY / (screenWidth * 0.3);
  const offset = progressRatio * 0.6;

  return {
    offset,
    value: clamp(startValue + offset, 0, 1),
  };
};
