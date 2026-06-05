import { describe, expect, it } from 'vitest';

import { createRefreshKeySignature } from './useRefresh';

describe('createRefreshKeySignature', () => {
  it('keeps refresh key segments unambiguous', () => {
    expect(createRefreshKeySignature(['a|b', 'c'])).not.toBe(
      createRefreshKeySignature(['a', 'b|c']),
    );
  });

  it('normalizes an omitted key to an empty signature', () => {
    expect(createRefreshKeySignature()).toBe('[]');
  });
});
