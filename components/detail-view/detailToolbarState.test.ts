import { describe, expect, it } from 'vitest';

import { resolveDetailToolbarState, withDetailToolbarOverride } from './detailToolbarState';

describe('detail toolbar state', () => {
  it('keeps a completed mutation scoped to the item that started it', () => {
    const episodeA = {
      itemId: 'episode-a',
      itemIsFavorite: false,
      itemIsWatched: false,
    };
    const episodeB = {
      itemId: 'episode-b',
      itemIsFavorite: true,
      itemIsWatched: true,
    };

    const afterEpisodeACompletes = withDetailToolbarOverride({}, 'episode-a', 'watched', true);

    expect(resolveDetailToolbarState({ ...episodeA, overrides: afterEpisodeACompletes })).toEqual({
      isFavorite: false,
      isWatched: true,
    });
    expect(resolveDetailToolbarState({ ...episodeB, overrides: afterEpisodeACompletes })).toEqual({
      isFavorite: true,
      isWatched: true,
    });
  });

  it('tracks favorite and watched overrides independently', () => {
    const watchedOverrides = withDetailToolbarOverride({}, 'movie-1', 'watched', true);
    const overrides = withDetailToolbarOverride(watchedOverrides, 'movie-1', 'favorite', false);

    expect(
      resolveDetailToolbarState({
        itemId: 'movie-1',
        itemIsFavorite: true,
        itemIsWatched: false,
        overrides,
      }),
    ).toEqual({ isFavorite: false, isWatched: true });
  });

  it('returns an inactive state before an item is available', () => {
    expect(
      resolveDetailToolbarState({
        itemId: undefined,
        itemIsFavorite: true,
        itemIsWatched: true,
        overrides: {},
      }),
    ).toEqual({ isFavorite: false, isWatched: false });
  });
});
