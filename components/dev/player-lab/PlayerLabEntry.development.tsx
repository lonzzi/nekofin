import { useRouter } from 'expo-router';
import { useCallback, useMemo, type PropsWithChildren } from 'react';

import type { PlayerLabController } from './PlayerLabEntry.types';

export const PLAYER_LAB_AVAILABLE = true;

export function PlayerLabHost({ children }: PropsWithChildren) {
  return children;
}

export function usePlayerLab(): PlayerLabController {
  const router = useRouter();
  const open = useCallback(() => router.push('/player-lab'), [router]);
  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/(settings)');
  }, [router]);

  return useMemo(() => ({ available: PLAYER_LAB_AVAILABLE, close, open }), [close, open]);
}
