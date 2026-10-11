import { mediaQueryKeys } from '@/services/media/queryKeys';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, it } from 'vitest';

import { clearServerConnectionQueries } from './serverConnectionQueries';

it('drops the old playback URL and rebuilds observers for the new endpoint without clearing other accounts', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const key = [...mediaQueryKeys.server('NAS'), 'stream-info'];
  client.setQueryData(key, 'http://lan.test/video');
  client.setQueryData([...mediaQueryKeys.server('Emby'), 'stream-info'], 'https://emby.test/video');
  const searchKey = mediaQueryKeys.aggregateSearchItems(['NAS', 'Emby'], 'anime');
  const otherSearchKey = mediaQueryKeys.aggregateSearchItems(['Emby'], 'anime');
  client.setQueryData(searchKey, ['old-results']);
  client.setQueryData(otherSearchKey, ['unaffected-results']);
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => 'http://lan.test/video',
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  await clearServerConnectionQueries(client, 'NAS');
  expect(client.getQueryData(key)).toBeUndefined();
  expect(client.getQueryData(searchKey)).toBeUndefined();
  expect(client.getQueryData(otherSearchKey)).toEqual(['unaffected-results']);
  expect(client.getQueryData([...mediaQueryKeys.server('Emby'), 'stream-info'])).toBe(
    'https://emby.test/video',
  );
  observer.setOptions({
    queryKey: key,
    queryFn: async () => 'https://wan.test/video',
    staleTime: Infinity,
  });
  await observer.refetch();
  expect(observer.getCurrentResult().data).toBe('https://wan.test/video');
  unsubscribe();
  client.clear();
});

it('prevents late endpoint responses from repopulating cleared account and aggregate caches', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const accountKey = mediaQueryKeys.homeSection('NAS', 'resume');
  const searchKey = mediaQueryKeys.aggregateSearchItems(['NAS', 'Emby'], 'anime');
  const otherKey = mediaQueryKeys.homeSection('Emby', 'resume');
  client.setQueryData(otherKey, ['keep-other-account']);
  const completions: (() => void)[] = [];
  const pending = [accountKey, searchKey].map((queryKey) =>
    client
      .fetchQuery({
        queryKey,
        queryFn: () =>
          new Promise<string[]>((resolve) => {
            completions.push(() => resolve(['obsolete-endpoint']));
          }),
      })
      .catch(() => undefined),
  );
  await clearServerConnectionQueries(client, 'NAS');
  completions.forEach((complete) => complete());
  await Promise.all(pending);
  expect(client.getQueryData(accountKey)).toBeUndefined();
  expect(client.getQueryData(searchKey)).toBeUndefined();
  expect(client.getQueryData(otherKey)).toEqual(['keep-other-account']);
  client.clear();
});
