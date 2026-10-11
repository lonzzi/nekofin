import { expect, it } from 'vitest';

import { TEMPORARY_FILE_CACHE_KEYS } from './cachePolicy';

it('temporary cleanup never includes user downloads', () => {
  const groups = {
    video: ['/cache/video'],
    image: ['/cache/images'],
    subtitle: ['/cache/subtitles'],
    temporary: ['/cache/tmp'],
    download: ['/documents/downloads'],
  };
  const deleted = TEMPORARY_FILE_CACHE_KEYS.flatMap((key) => groups[key]);
  expect(deleted).not.toContain('/documents/downloads');
  expect(deleted).toContain('/cache/video');
});
