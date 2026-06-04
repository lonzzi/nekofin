import {
  DefaultError,
  QueryKey,
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';

import { useRefetchOnScreenFocus, type RefetchOnScreenFocus } from './useRefetchOnScreenFocus';

export function useQueryWithFocus<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    /** 是否在页面 focus 时自动刷新 */
    refetchOnScreenFocus?: RefetchOnScreenFocus;
  },
): UseQueryResult<NoInfer<TData>, TError> {
  const { refetchOnScreenFocus = 'stale', ...queryOptions } = options;
  const query = useQuery(queryOptions);

  useRefetchOnScreenFocus(
    {
      isEnabled: query.isEnabled,
      fetchStatus: query.fetchStatus,
      isStale: query.isStale,
      refetch: query.refetch,
    },
    refetchOnScreenFocus,
  );

  return query;
}
