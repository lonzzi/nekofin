import { describe, expect, it } from 'vitest';

import { updateCachedMediaItemUserData } from './cache';
import type { MediaItem } from './types';

const mediaItem: MediaItem = {
  id: 'item-1',
  name: 'Item One',
  type: 'Movie' as const,
  raw: { Id: 'item-1' },
  userData: {
    played: false,
    isFavorite: false,
  },
};

describe('updateCachedMediaItemUserData', () => {
  it('updates matching media items in arrays', () => {
    const data = [mediaItem, { ...mediaItem, id: 'item-2' }];

    const next = updateCachedMediaItemUserData(data, 'item-1', (current) => ({
      ...current,
      isFavorite: true,
    }));

    expect(next[0].userData?.isFavorite).toBe(true);
    expect(next[1].userData?.isFavorite).toBe(false);
    expect(next).not.toBe(data);
  });

  it('updates nested detail bundles and infinite query pages', () => {
    const data = {
      pages: [
        {
          items: [mediaItem],
          total: 1,
        },
      ],
      pageParams: [0],
      detail: {
        item: mediaItem,
      },
    };

    const next = updateCachedMediaItemUserData(data, 'item-1', (current) => ({
      ...current,
      played: true,
      playedPercentage: 100,
    }));

    expect(next.pages[0].items[0].userData?.played).toBe(true);
    expect(next.detail.item.userData?.playedPercentage).toBe(100);
  });

  it('keeps the same reference when no item matches', () => {
    const data = [mediaItem];

    const next = updateCachedMediaItemUserData(data, 'missing', (current) => ({
      ...current,
      isFavorite: true,
    }));

    expect(next).toBe(data);
  });
});
