import { describe, expect, it } from 'vitest';

import {
  normalizeMediaItemType,
  normalizeMediaItemTypeList,
  normalizePersonType,
} from './itemTypes';

describe('media item type normalization', () => {
  it('keeps known Jellyfin/Emby item and person types', () => {
    expect(normalizeMediaItemType('CollectionFolder')).toBe('CollectionFolder');
    expect(normalizeMediaItemType('Episode')).toBe('Episode');
    expect(normalizePersonType('Composer')).toBe('Composer');
  });

  it('falls back unknown or missing values to Other', () => {
    expect(normalizeMediaItemType('CustomPluginItem')).toBe('Other');
    expect(normalizeMediaItemType(null)).toBe('Other');
    expect(normalizePersonType('CustomPersonKind')).toBe('Other');
    expect(normalizePersonType(undefined)).toBe('Other');
  });

  it('normalizes request item type lists for provider APIs', () => {
    expect(normalizeMediaItemTypeList(['Movie', 'Other', 'CollectionFolder'])).toEqual([
      'Movie',
      'CollectionFolder',
    ]);
    expect(normalizeMediaItemTypeList([])).toBeUndefined();
    expect(normalizeMediaItemTypeList(['Other'])).toBeUndefined();
  });
});
