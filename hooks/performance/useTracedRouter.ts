import { formatRouteTarget } from '@/lib/performance/performanceMetrics';
import { usePerformanceMonitor } from '@/lib/performance/PerformanceMonitorContext';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

type Router = ReturnType<typeof useRouter>;

export function useTracedRouter(scope?: string): Router {
  const router = useRouter();
  const { traceNavigation } = usePerformanceMonitor();

  const getLabel = useCallback(
    (action: string, target?: unknown) => {
      const prefix = scope ? `${scope}:` : '';
      return target == null ? `${prefix}${action}` : `${prefix}${formatRouteTarget(target)}`;
    },
    [scope],
  );

  const push = useCallback<Router['push']>(
    (...args) => {
      traceNavigation('push', getLabel('push', args[0]));
      return router.push(...args);
    },
    [getLabel, router, traceNavigation],
  );

  const replace = useCallback<Router['replace']>(
    (...args) => {
      traceNavigation('replace', getLabel('replace', args[0]));
      return router.replace(...args);
    },
    [getLabel, router, traceNavigation],
  );

  const navigate = useCallback<Router['navigate']>(
    (...args) => {
      traceNavigation('navigate', getLabel('navigate', args[0]));
      return router.navigate(...args);
    },
    [getLabel, router, traceNavigation],
  );

  const back = useCallback<Router['back']>(() => {
    traceNavigation('back', getLabel('back'));
    return router.back();
  }, [getLabel, router, traceNavigation]);

  return useMemo(
    () => ({
      ...router,
      back,
      navigate,
      push,
      replace,
    }),
    [back, navigate, push, replace, router],
  );
}
