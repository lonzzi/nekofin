import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getHomeCarouselLibraries,
  setHomeCarouselLibraries,
  setHomeCarouselLibraryEnabled,
  subscribeToHomeCarouselLibraries,
} from './homeCarouselConfig';

const mocks = vi.hoisted(() => ({
  values: new Map<string, string>(),
  listeners: new Set<(key: string) => void>(),
}));
vi.mock('@/lib/storage', () => ({
  storage: {
    getString: (key: string) => mocks.values.get(key),
    set: (key: string, value: string) => {
      mocks.values.set(key, value);
      mocks.listeners.forEach((listener) => listener(key));
    },
    delete: (key: string) => {
      mocks.values.delete(key);
      mocks.listeners.forEach((listener) => listener(key));
    },
    addOnValueChangedListener: (listener: (key: string) => void) => {
      mocks.listeners.add(listener);
      return { remove: () => mocks.listeners.delete(listener) };
    },
  },
}));

beforeEach(() => {
  mocks.values.clear();
  mocks.listeners.clear();
});

describe('home carousel library preferences', () => {
  it('defaults to all visible libraries and persists a custom selection per account', () => {
    expect(getHomeCarouselLibraries('account-a')).toBeNull();
    setHomeCarouselLibraries('account-a', ['movies', 'anime', 'movies']);
    expect(getHomeCarouselLibraries('account-a')).toEqual(['anime', 'movies']);
    expect(getHomeCarouselLibraries('account-b')).toBeNull();
    setHomeCarouselLibraries('account-b', ['other-library']);
    expect(getHomeCarouselLibraries('account-a')).toEqual(['anime', 'movies']);
    expect(getHomeCarouselLibraries('account-b')).toEqual(['other-library']);
  });

  it('distinguishes selecting no libraries from restoring all libraries', () => {
    setHomeCarouselLibraries('account', []);
    expect(getHomeCarouselLibraries('account')).toEqual([]);
    setHomeCarouselLibraries('account', null);
    expect(getHomeCarouselLibraries('account')).toBeNull();
  });

  it('keeps consecutive toggles and starts custom selection from the visible libraries', () => {
    const visibleIds = ['movies', 'anime', 'series'];
    setHomeCarouselLibraryEnabled('account', 'movies', false, visibleIds);
    setHomeCarouselLibraryEnabled('account', 'series', false, visibleIds);
    expect(getHomeCarouselLibraries('account')).toEqual(['anime']);
    setHomeCarouselLibraryEnabled('account', 'movies', true, visibleIds);
    expect(getHomeCarouselLibraries('account')).toEqual(['anime', 'movies']);
    setHomeCarouselLibraryEnabled('account', 'anime', false, visibleIds);
    setHomeCarouselLibraryEnabled('account', 'movies', false, visibleIds);
    expect(getHomeCarouselLibraries('account')).toEqual([]);
  });

  it.each(['invalid-json', 'null', '{}', '["movies",42]'])(
    'ignores invalid stored preferences: %s',
    (value) => {
      mocks.values.set('homeCarouselLibraries_account', value);
      expect(getHomeCarouselLibraries('account')).toBeNull();
    },
  );

  it('notifies mounted homes on selection/reset and releases the storage listener', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToHomeCarouselLibraries(onChange);
    setHomeCarouselLibraries('account', ['movies']);
    setHomeCarouselLibraries('account', null);
    expect(onChange).toHaveBeenCalledTimes(2);
    mocks.listeners.forEach((listener) => listener('hiddenUserViews_account'));
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    setHomeCarouselLibraries('account', []);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
