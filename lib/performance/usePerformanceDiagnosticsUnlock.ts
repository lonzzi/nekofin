import { storage } from '@/lib/storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE,
  registerPerformanceDiagnosticsTap,
  type PerformanceDiagnosticsTapState,
} from './performanceDiagnosticsUnlock';

const STORAGE_KEY = 'performanceDiagnostics.unlocked.v1';

const unlockListeners = new Set<(isUnlocked: boolean) => void>();

function readUnlockedState() {
  return storage.getBoolean(STORAGE_KEY) ?? false;
}

function notifyUnlockListeners(isUnlocked: boolean) {
  unlockListeners.forEach((listener) => {
    listener(isUnlocked);
  });
}

export function usePerformanceDiagnosticsUnlock() {
  const [isUnlocked, setIsUnlocked] = useState(readUnlockedState);
  const tapStateRef = useRef<PerformanceDiagnosticsTapState>(
    INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE,
  );

  useEffect(() => {
    unlockListeners.add(setIsUnlocked);

    return () => {
      unlockListeners.delete(setIsUnlocked);
    };
  }, []);

  const unlock = useCallback(() => {
    storage.set(STORAGE_KEY, true);
    setIsUnlocked(true);
    notifyUnlockListeners(true);
  }, []);

  const lock = useCallback(() => {
    storage.set(STORAGE_KEY, false);
    tapStateRef.current = INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE;
    setIsUnlocked(false);
    notifyUnlockListeners(false);
  }, []);

  const registerVersionTap = useCallback(() => {
    const result = registerPerformanceDiagnosticsTap(tapStateRef.current, Date.now());
    tapStateRef.current = result.state;

    if (!result.didUnlock) {
      return false;
    }

    unlock();
    return true;
  }, [unlock]);

  return {
    isUnlocked,
    lock,
    registerVersionTap,
    unlock,
  };
}
