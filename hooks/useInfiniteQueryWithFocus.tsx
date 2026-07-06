import {
  DefaultError,
  InfiniteData,
  QueryKey,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';

import { useRefetchOnScreenFocus, type RefetchOnScreenFocus } from './useRefetchOnScreenFocus';

export function useInfiniteQueryWithFocus<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam> & {
    /** 是否在页面 focus 时自动刷新 */
    refetchOnScreenFocus?: RefetchOnScreenFocus;
  },
): UseInfiniteQueryResult<NoInfer<TData>, TError> {
  const { refetchOnScreenFocus = 'stale', ...queryOptions } = options;
  const query = useInfiniteQuery(queryOptions);

  useRefetchOnScreenFocus(
    {
      isEnabled: query.isEnabled,
      fetchStatus: query.fetchStatus,
      isStale: query.isStale,
      refetch: query.refetch,
    },
    refetchOnScreenFocus,
    queryOptions.queryKey,
  );

  return query;
}
