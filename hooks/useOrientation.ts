import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback } from 'react';

/**
 * 命令式地控制屏幕方向:不依赖 native stack 的 `orientation` 选项,而是显式
 * lock/unlock,便于跟随用户设置。
 *
 * - `lockOrientation(DEFAULT)` 等价于解锁(跟随系统自由旋转)。
 * - `unlockOrientation()` 解除任何锁定。
 */
export function useOrientation() {
  const lockOrientation = useCallback(async (lock: ScreenOrientation.OrientationLock) => {
    try {
      if (lock === ScreenOrientation.OrientationLock.DEFAULT) {
        await ScreenOrientation.unlockAsync();
        return;
      }
      await ScreenOrientation.lockAsync(lock);
    } catch (error) {
      console.warn('Failed to lock screen orientation', error);
    }
  }, []);

  const unlockOrientation = useCallback(async () => {
    try {
      await ScreenOrientation.unlockAsync();
    } catch (error) {
      console.warn('Failed to unlock screen orientation', error);
    }
  }, []);

  return { lockOrientation, unlockOrientation };
}

export type VideoOrientationPreference = 'landscape' | 'portrait' | 'auto';

/** 把用户设置里的字符串映射到 expo 的 OrientationLock。 */
export function resolveVideoOrientationLock(
  preference: VideoOrientationPreference,
): ScreenOrientation.OrientationLock {
  switch (preference) {
    case 'portrait':
      return ScreenOrientation.OrientationLock.PORTRAIT_UP;
    case 'auto':
      return ScreenOrientation.OrientationLock.DEFAULT;
    case 'landscape':
    default:
      return ScreenOrientation.OrientationLock.LANDSCAPE;
  }
}
