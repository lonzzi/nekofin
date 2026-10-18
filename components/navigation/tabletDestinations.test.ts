import { describe, expect, it } from 'vitest';

import { tabletDestinationKey } from './tabletDestinations';

describe('tablet sidebar route selection', () => {
  it.each([
    [['(tabs)', '(home)', 'movie', 'film'], 'home'],
    [['(tabs)', '(servers)', 'library'], 'servers'],
    [['(tabs)', '(servers)', 'add-server', 'emby'], 'servers'],
    [['(tabs)', '(favorites)', 'episode'], 'favorites'],
    [['(tabs)', '(search)', 'series', 'show'], 'search'],
    [['(tabs)', '(settings)', 'audio'], 'settings'],
    [['(tabs)', '(settings)', 'subtitle-fonts'], 'settings'],
    [['(tabs)', '(settings)', 'subtitle-font-url'], 'settings'],
    [['(tabs)', '(settings)', 'playback'], 'settings'],
    [['(tabs)', '(settings)', 'danmaku-source', 'source-id'], 'settings'],
    [['(tabs)', '(settings)', 'danmaku-sources'], 'settings'],
    [['(tabs)', '(settings)', 'performance'], 'settings'],
    [['(tabs)', '(settings)'], 'settings'],
  ])('keeps the active destination for %j', (segments, expected) => {
    expect(tabletDestinationKey(segments)).toBe(expected);
  });
});
