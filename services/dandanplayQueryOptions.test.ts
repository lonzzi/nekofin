import { describe, expect, it, vi } from 'vitest';

import { dandanplayCommentsQueryOptions } from './dandanplayQueryOptions';
import type { MediaItem } from './media/types';

const item: MediaItem = {
  id: 'item-1',
  name: 'Item One',
  type: 'Episode',
  raw: {},
};

describe('dandanplayCommentsQueryOptions', () => {
  it('builds comments options and normalizes missing results', async () => {
    const fetchComments = vi.fn(async () => undefined);
    const options = dandanplayCommentsQueryOptions({
      serverId: 'server-1',
      item,
      originalTitle: 'Original Title',
      useManualComments: false,
      fetchComments,
    });

    expect(options.queryKey).toEqual([
      'media',
      'server',
      'server-1',
      'comments',
      'item-1',
      'Original Title',
    ]);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual({
      comments: [],
      episodeInfo: undefined,
    });
  });

  it('disables automatic comments when manual comments are active', () => {
    const options = dandanplayCommentsQueryOptions({
      serverId: 'server-1',
      item,
      originalTitle: 'Original Title',
      useManualComments: true,
      fetchComments: vi.fn(),
    });

    expect(options.enabled).toBe(false);
  });

  it('enables automatic comments when the series name is available without an original title', async () => {
    const fetchComments = vi.fn(async () => ({ comments: [], episodeInfo: undefined }));
    const seriesItem = { ...item, seriesName: 'Series Name' };
    const options = dandanplayCommentsQueryOptions({
      serverId: 'server-1',
      item: seriesItem,
      originalTitle: undefined,
      useManualComments: false,
      fetchComments,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual({
      comments: [],
      episodeInfo: undefined,
    });
    expect(fetchComments).toHaveBeenCalledWith(seriesItem, undefined);
  });
});
