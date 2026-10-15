import { describe, expect, it } from 'vitest';

import { tabletDestinationKey } from './tabletDestinations';

describe('tablet sidebar route selection', () => {
  it.each([
    [['(tabs)', '(home)', 'movie', 'film'], 'home'],
    [['(tabs)', '(servers)', 'library'], 'servers'],
    [['(tabs)', '(servers)', 'add-server', 'emby'], 'servers'],
    [['(tabs)', '(favorites)', 'episode'], 'favorites'],
    [['(tabs)', '(search)', 'series', 'show'], 'search'],
    [['(tabs)', '(settings)', 'audio'], 'audio'],
    [['(tabs)', '(settings)', 'playback'], 'playback'],
    [['(tabs)', '(settings)', 'danmaku-source', 'source-id'], 'danmaku'],
    [['(tabs)', '(settings)', 'danmaku-sources'], 'danmaku'],
    [['(tabs)', '(settings)', 'performance'], 'settings'],
    [['(tabs)', '(settings)'], 'settings'],
  ])('keeps the active destination for %j', (segments, expected) => {
    expect(tabletDestinationKey(segments)).toBe(expected);
  });
});
