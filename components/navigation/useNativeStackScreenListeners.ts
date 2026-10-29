import {
  beginNavigationTransition,
  finishNavigationScope,
  finishNavigationTransition,
} from '@/lib/navigationWork';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useCallback } from 'react';

export function useNativeStackScreenListeners(scope: string) {
  const performanceListeners = usePerformanceStackScreenListeners(scope);
  return useCallback(
    (props: Parameters<typeof performanceListeners>[0] & { route: { key?: string } }) => {
      const listeners = performanceListeners(props);
      const key = `${scope}:${props.route.key ?? props.route.name}`;
      return {
        transitionStart(event: Parameters<typeof listeners.transitionStart>[0]) {
          beginNavigationTransition(key);
          listeners.transitionStart(event);
        },
        transitionEnd(event: Parameters<typeof listeners.transitionEnd>[0]) {
          finishNavigationTransition(key);
          listeners.transitionEnd(event);
        },
        gestureCancel() {
          finishNavigationTransition(key);
          listeners.gestureCancel();
        },
      };
    },
    [performanceListeners, scope],
  );
}

const nativeProps = new Map<string, { onFinishTransitioning: () => void }>();
export function nativeStackTransitionProps(scope: string) {
  if (!nativeProps.has(scope)) {
    nativeProps.set(scope, { onFinishTransitioning: () => finishNavigationScope(scope) });
  }
  return nativeProps.get(scope)!;
}
