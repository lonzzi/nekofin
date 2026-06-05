import { useCallback, useEffect, useMemo, useState } from 'react';

type FetchFn = () => Promise<unknown>;
type RefreshKey = (string | number | null | undefined)[];

export function createRefreshKeySignature(key?: RefreshKey) {
  return JSON.stringify(key ?? []);
}

const useRefresh = (query: FetchFn, key?: RefreshKey) => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    return Promise.resolve()
      .then(query)
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [query]);

  const keySignature = useMemo(() => createRefreshKeySignature(key), [key]);

  useEffect(() => {
    setRefreshing(false);
  }, [keySignature]);

  return { refreshing, onRefresh };
};

export default useRefresh;
