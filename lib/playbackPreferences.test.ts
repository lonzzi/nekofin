import { describe, expect, it } from 'vitest';

import { preferredTrackId } from './playbackPreferences';

describe('preferred native track', () => {
  it('matches language aliases and keeps native IDs', () => {
    expect(
      preferredTrackId(
        [
          { id: 8, lang: 'eng' },
          { id: 4, lang: 'chi' },
        ],
        'zh',
      ),
    ).toBe(4);
    expect(preferredTrackId([{ id: 7, lang: 'zh-Hans' }], 'zh')).toBe(7);
  });
  it('leaves server selection unchanged when unavailable or automatic', () => {
    expect(preferredTrackId([{ id: 8, lang: 'eng' }], 'ja')).toBeUndefined();
    expect(preferredTrackId([{ id: 8, lang: 'eng' }], 'auto')).toBeUndefined();
  });
});
