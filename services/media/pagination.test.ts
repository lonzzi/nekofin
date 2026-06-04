import { describe, expect, it } from 'vitest';

import { getNextMediaPageParam } from './pagination';

describe('getNextMediaPageParam', () => {
  it('returns the loaded item count as the next offset', () => {
    expect(
      getNextMediaPageParam({ items: ['c'], total: 5 }, [
        { items: ['a', 'b'], total: 5 },
        { items: ['c'], total: 5 },
      ]),
    ).toBe(3);
  });

  it('stops when all items are loaded', () => {
    expect(
      getNextMediaPageParam({ items: ['c'], total: 3 }, [
        { items: ['a', 'b'], total: 3 },
        { items: ['c'], total: 3 },
      ]),
    ).toBeUndefined();
  });

  it('stops when the last page is empty', () => {
    expect(
      getNextMediaPageParam({ items: [], total: 10 }, [
        { items: ['a'], total: 10 },
        { items: [], total: 10 },
      ]),
    ).toBeUndefined();
  });
});
