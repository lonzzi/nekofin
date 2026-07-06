import { useOptionalPerformanceMonitorActions } from '@/lib/performance/PerformanceMonitorContext';
import type { QueryKey } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';

export type RefetchOnScreenFocus = boolean | 'stale';

type ScreenFocusQueryState = {
  isEnabled: boolean;
  fetchStatus: string;
  isStale: boolean;
  refetch: () => unknown;
};

function formatQueryKey(queryKey?: QueryKey) {
  if (!queryKey) return undefined;

  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}

export function useRefetchOnScreenFocus(
  queryState: ScreenFocusQueryState,
  refetchOnScreenFocus: RefetchOnScreenFocus = 'stale',
  queryKey?: QueryKey,
) {
  const performanceActions = useOptionalPerformanceMonitorActions();
  const didFocusOnceRef = useRef(false);
  const queryStateRef = useRef(queryState);
  const queryKeyLabel = useMemo(() => formatQueryKey(queryKey), [queryKey]);

  queryStateRef.current = queryState;

  useFocusEffect(
    useCallback(() => {
      if (!didFocusOnceRef.current) {
        didFocusOnceRef.current = true;
        return;
      }

      const current = queryStateRef.current;
      if (
        !current.isEnabled ||
        current.fetchStatus === 'fetching' ||
        refetchOnScreenFocus === false
      ) {
        return;
      }

      if (refetchOnScreenFocus !== true && !(refetchOnScreenFocus === 'stale' && current.isStale)) {
        return;
      }

      performanceActions?.recordEvent({
        detail: queryKeyLabel,
        name: 'screen focus refetch scheduled',
        status: 'pending',
        type: 'trace',
      });

      const interaction = InteractionManager.runAfterInteractions(() => {
        const latest = queryStateRef.current;
        if (!latest.isEnabled || latest.fetchStatus === 'fetching') return;

        performanceActions?.recordEvent({
          detail: queryKeyLabel,
          name: 'screen focus refetch',
          status: 'ok',
          type: 'trace',
        });
        void latest.refetch();
      });

      return () => interaction.cancel();
    }, [performanceActions, queryKeyLabel, refetchOnScreenFocus]),
  );
}
