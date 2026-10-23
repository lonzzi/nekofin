import dayjs from '@/lib/dayjs';
import { t as tr } from '@/lib/i18n';

export const ticksToSeconds = (ticks: number) => {
  return ticks / 10000000;
};

export const ticksToMilliseconds = (ticks: number) => {
  return ticks / 10000;
};

// This also runs in Reanimated's UI runtime; keep Day.js calls outside this function.
export const formatTimeWorklet = (time: number) => {
  'worklet';

  const hours = Math.floor(time / 3600000);
  const minutes = Math.floor((time % 3600000) / 60000);
  const seconds = Math.floor((time % 60000) / 1000);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const formatDurationFromTicks = (
  ticks?: number | null,
  options?: { showUnits?: boolean },
) => {
  if (!ticks) return '';
  const totalSeconds = Math.floor(ticksToSeconds(ticks));
  const duration = dayjs.duration(totalSeconds, 'seconds');
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  const seconds = duration.seconds();

  if (options?.showUnits) {
    const parts = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 || (hours === 0 && minutes === 0)) {
      parts.push(`${seconds}s`);
    }
    return parts.join('');
  }

  // Duration's HH token wraps at 24; media runtimes must retain total hours.
  const prefix = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : '';
  return prefix + duration.format('mm:ss');
};

export const formatChineseDurationFromTicks = (
  ticks?: number | null,
  options?: { largest?: 1 | 2 | 3; includeSeconds?: boolean },
) => {
  if (!ticks) return '';

  const totalSeconds = Math.floor(ticksToSeconds(ticks));
  const duration = dayjs.duration(totalSeconds, 'seconds');
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  const seconds = duration.seconds();
  const largest = options?.largest ?? 2;
  const includeSeconds = options?.includeSeconds ?? totalSeconds < 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(tr('time.hoursShort', { hours: hours }));
  if (minutes > 0) parts.push(tr('time.minutesShort', { minutes: minutes }));
  if (includeSeconds && seconds > 0) parts.push(tr('time.secondsShort', { seconds: seconds }));

  if (parts.length === 0) return tr('time.zeroSeconds');
  return parts.slice(0, largest).join(' ');
};
