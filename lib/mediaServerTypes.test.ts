import { describe, expect, it } from 'vitest';

import { isMediaServerType } from './mediaServerTypes';

describe('media server route types', () => {
  it.each(['jellyfin', 'emby'])('accepts the supported route %s', (type) => {
    expect(isMediaServerType(type)).toBe(true);
  });

  it.each([undefined, '', 'unknown', 'Emby', '__proto__', 'constructor', 'toString'])(
    'rejects unsupported route value %s',
    (type) => {
      expect(isMediaServerType(type)).toBe(false);
    },
  );
});
