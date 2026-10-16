import type { ApiClient } from '@/lib/request';
import { describe, expect, it, vi } from 'vitest';

import {
  getEmbyThumbnail,
  getEmbyThumbnailSet,
  getEmbyThumbnailUrl,
  parseEmbyThumbnailSet,
} from './thumbnails';

const first = { PositionTicks: 0, ImageTag: 'a' };
const second = { PositionTicks: 100000000, ImageTag: 'b' };
const third = { PositionTicks: 200000000, ImageTag: 'c' };

describe('Emby timeline previews', () => {
  it('validates and sorts real ThumbnailSet response entries', () => {
    expect(
      parseEmbyThumbnailSet({
        AspectRatio: 16 / 9,
        Thumbnails: [
          third,
          first,
          { PositionTicks: -1, ImageTag: 'bad' },
          second,
          { PositionTicks: 1, ImageTag: '' },
        ],
      }),
    ).toEqual({ AspectRatio: 16 / 9, Thumbnails: [first, second, third] });
    expect(parseEmbyThumbnailSet(null).Thumbnails).toEqual([]);
    expect(parseEmbyThumbnailSet({ Thumbnails: [] }).Thumbnails).toEqual([]);
    expect(parseEmbyThumbnailSet({ AspectRatio: Infinity }).AspectRatio).toBeUndefined();
  });
  it('selects the frame at or immediately before the target time', () => {
    const set = { Thumbnails: [first, second, third] };
    expect(getEmbyThumbnail(set, 9999)).toEqual(first);
    expect(getEmbyThumbnail(set, 10000)).toEqual(second);
    expect(getEmbyThumbnail(set, 19999)).toEqual(second);
    expect(getEmbyThumbnail(set, 99999)).toEqual(third);
    expect(getEmbyThumbnail({ Thumbnails: [] }, 1000)).toBeNull();
    expect(getEmbyThumbnail({ Thumbnails: [second] }, 0)).toBeNull();
  });
  it('requests the playing media version and propagates cancellation', async () => {
    const get = vi.fn().mockResolvedValue({ data: { Thumbnails: [first] } });
    const controller = new AbortController();
    await expect(
      getEmbyThumbnailSet(
        { get } as unknown as ApiClient,
        'item/1',
        'version_9',
        controller.signal,
      ),
    ).resolves.toEqual({ AspectRatio: undefined, Thumbnails: [first] });
    expect(get).toHaveBeenCalledWith(
      '/Items/item%2F1/ThumbnailSet',
      { Width: 320, MediaSourceId: 'version_9' },
      { signal: controller.signal },
    );
  });
  it('uses Emby Thumbnail image semantics instead of the Jellyfin trickplay route', () => {
    expect(getEmbyThumbnailUrl('https://example.test/emby/', '8', second, 'mediasource_9')).toBe(
      'https://example.test/emby/Items/8/Images/Thumbnail?MaxWidth=320&tag=b&PositionTicks=100000000&MediaSourceId=mediasource_9',
    );
  });
});
