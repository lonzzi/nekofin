import { OrientationLock } from 'expo-screen-orientation';

export type VideoOrientationPreference = 'landscape' | 'portrait' | 'auto';

export function resolveVideoScreenOrientation(preference: string | undefined) {
  switch (preference) {
    case 'portrait':
      return 'portrait_up' as const;
    case 'auto':
      return 'all' as const;
    default:
      return 'landscape' as const;
  }
}

export function resolveVideoOrientationLock(preference: string | undefined) {
  switch (preference) {
    case 'portrait':
      return OrientationLock.PORTRAIT_UP;
    case 'auto':
      return OrientationLock.DEFAULT;
    default:
      return OrientationLock.LANDSCAPE;
  }
}
