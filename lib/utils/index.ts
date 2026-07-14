import uuid from 'react-native-uuid';

import { storage } from '../storage';

export const getDeviceId = () => {
  const deviceId = storage.getString('deviceId');
  if (!deviceId) {
    const newDeviceId = uuid.v4();
    storage.set('deviceId', newDeviceId);
    return newDeviceId;
  }
  return deviceId;
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export {
  formatChineseDurationFromTicks,
  formatDurationFromTicks,
  formatTimeWorklet,
  ticksToMilliseconds,
  ticksToSeconds,
} from './duration';
export { formatBitrate, formatRating } from './format';
export { isNil } from './guards';
