import { useCallback, useEffect, useRef, useState } from 'react';

type TimerOptions = {
  interval?: number;
  isRunning?: boolean;
  initialTime?: number;
  onTick?: (time: number) => void;
  playbackRate?: number;
};

export function usePreciseTimer({
  interval = 100,
  isRunning = false,
  initialTime = 0,
  onTick,
  playbackRate = 1,
}: TimerOptions) {
  const [time, setTime] = useState(initialTime);
  const animationFrameRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  const step = useCallback(
    (timestamp: number) => {
      if (!startTimestampRef.current) {
        startTimestampRef.current = timestamp;
        lastTickTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTickTimeRef.current;
      if (delta >= interval) {
        const ticks = Math.floor(delta / interval);
        lastTickTimeRef.current += ticks * interval;
        setTime((prevTime) => {
          const scaledIncrement = ticks * interval * Math.max(0.25, playbackRate);
          const newTime = prevTime + scaledIncrement;
          if (onTick) {
            onTick(newTime);
          }
          return newTime;
        });
      }

      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    },
    [interval, isRunning, onTick, playbackRate],
  );

  useEffect(() => {
    if (isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      startTimestampRef.current = null;
      lastTickTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(step);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRunning, step]);

  const start = useCallback(() => {
    if (!isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      startTimestampRef.current = null;
      lastTickTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(step);
    }
  }, [isRunning, step]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const sync = useCallback((newTime: number) => {
    setTime(newTime);
  }, []);

  return {
    time,
    start,
    stop,
    sync,
  };
}
