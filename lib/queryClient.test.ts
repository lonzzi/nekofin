import { QueryObserver } from '@tanstack/react-query';
import { expect, it } from 'vitest';

import { createAppQueryClient } from './queryClient';

it('bounds inactive catalog entries without evicting a visible query or unrelated playback', () => {
  const client = createAppQueryClient();
  const key = (id: string) => ['media', 'server', 'account', 'item-detail', id];
  const visibleKey = key('visible');
  client.setQueryData(visibleKey, { name: 'visible' }, { updatedAt: 1 });
  const observer = new QueryObserver(client, { queryKey: visibleKey, enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  const playbackKey = ['media', 'server', 'account', 'stream-info', 'video'];
  client.setQueryData(playbackKey, { sessionId: 'playing' });
  for (let index = 0; index < 100; index++)
    client.setQueryData(key(String(index)), { index }, { updatedAt: index + 2 });
  expect(
    client
      .getQueryCache()
      .getAll()
      .filter((query) => query.queryKey[3] === 'item-detail'),
  ).toHaveLength(64);
  expect(client.getQueryData(visibleKey)).toEqual({ name: 'visible' });
  expect(client.getQueryData(playbackKey)).toEqual({ sessionId: 'playing' });
  expect(client.getQueryData(key('0'))).toBeUndefined();
  expect(client.getQueryData(key('99'))).toEqual({ index: 99 });
  unsubscribe();
  client.clear();
});
