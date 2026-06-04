import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

export type RefetchOnScreenFocus = boolean | 'stale';

type ScreenFocusQueryState = {
  isEnabled: boolean;
  fetchStatus: string;
  isStale: boolean;
  refetch: () => unknown;
};

export function useRefetchOnScreenFocus(
  queryState: ScreenFocusQueryState,
  refetchOnScreenFocus: RefetchOnScreenFocus = 'stale',
) {
  const didFocusOnceRef = useRef(false);
  const queryStateRef = useRef(queryState);

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

      if (refetchOnScreenFocus === true || (refetchOnScreenFocus === 'stale' && current.isStale)) {
        void current.refetch();
      }
    }, [refetchOnScreenFocus]),
  );
}
