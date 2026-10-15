import { describe, expect, it } from 'vitest';

import type { DandanComment } from './dandanplay';
import { mergeDanmakuComments } from './danmakuMerge';

const comment = (overrides: Partial<DandanComment> = {}): DandanComment => ({
  id: 1,
  timeInSeconds: 12,
  text: '相同的弹幕',
  mode: 1,
  colorHex: '#ffffff',
  user: '[BiliBili]abcd1234',
  ...overrides,
});

describe('danmaku merge deduplication', () => {
  it('matches the same sender across rounding boundaries and provider tag casing', () => {
    const preferred = comment({ timeInSeconds: 12.049 });
    const copy = comment({ id: 99, timeInSeconds: 12.051, user: '[bilibili]ABCD1234' });
    expect(mergeDanmakuComments([[preferred], [copy]])).toEqual([preferred]);
  });

  it('recognizes Bahamut aliases and ignores proxy restyling for a known sender', () => {
    const preferred = comment({ user: '[Gamer]viewer-1' });
    const copy = comment({
      timeInSeconds: 12.15,
      user: '[bahamut]viewer-1',
      mode: 5,
      colorHex: '#ff0000',
    });
    expect(mergeDanmakuComments([[preferred], [copy]])).toEqual([preferred]);
  });

  it('removes known-sender duplicates already present within an aggregated track', () => {
    const original = comment();
    const duplicate = comment({ id: 2, timeInSeconds: 12.02 });
    const later = comment({ id: 3, timeInSeconds: 12.5 });
    const otherUser = comment({ id: 4, user: '[BiliBili]1234abcd' });
    const merged = mergeDanmakuComments([[original, duplicate, later, otherUser]]);
    expect(merged.map((entry) => [entry.user, entry.timeInSeconds])).toEqual([
      [original.user, 12],
      [otherUser.user, 12],
      [later.user, 12.5],
    ]);
  });

  it('keeps distinct senders even when content, timestamp and API-local comment ID are equal', () => {
    const merged = mergeDanmakuComments([
      [comment({ user: '[BiliBili]viewer-1' })],
      [comment({ user: '[BiliBili]viewer-2' })],
    ]);
    expect(merged).toHaveLength(2);
  });

  it('scopes known sender IDs to their original platform', () => {
    expect(
      mergeDanmakuComments([
        [comment({ user: '[Gamer]viewer-1' })],
        [comment({ user: '[BiliBili]viewer-1' })],
      ]),
    ).toHaveLength(2);
  });

  it('handles bare hashes and bracketed hashes without rewriting source-filter labels', () => {
    const preferred = comment({ user: '[abcd1234]' });
    expect(mergeDanmakuComments([[preferred], [comment({ user: 'ABCD1234' })]])).toEqual([
      preferred,
    ]);
  });

  it('matches source-only proxy labels conservatively across tracks', () => {
    const preferred = comment({ user: '[dandanplay]' });
    const copy = comment({ user: 'abcd1234', timeInSeconds: 12.2 });
    expect(mergeDanmakuComments([[preferred], [copy]])).toEqual([preferred]);
  });

  it.each(['', '0', 'unknown', '[gamer]', '[renren]'])(
    'preserves chant multiplicity when sender identity is missing (%s)',
    (user) => {
      const merged = mergeDanmakuComments([
        [comment({ user }), comment({ user, id: 2 })],
        [comment({ user, timeInSeconds: 12.1 })],
        [comment({ user, timeInSeconds: 12.2 }), comment({ user, timeInSeconds: 12.2, id: 2 })],
      ]);
      expect(merged).toHaveLength(2);
    },
  );

  it('does not let a redacted sender bridge two different real senders', () => {
    const merged = mergeDanmakuComments([
      [comment({ user: '[dandanplay]' })],
      [comment({ user: '[BiliBili]viewer-1' })],
      [comment({ user: '[BiliBili]viewer-2' })],
    ]);
    expect(merged).toHaveLength(2);
  });

  it('requires equal display styles when sender identity is missing', () => {
    expect(
      mergeDanmakuComments([
        [comment({ user: '[dandanplay]' })],
        [comment({ user: '[gamer]', mode: 5 })],
        [comment({ user: '[gamer]', colorHex: '#ff0000' })],
      ]),
    ).toHaveLength(3);
  });

  it('preserves intentional style variations within a single known-sender track', () => {
    expect(mergeDanmakuComments([[comment(), comment({ mode: 5 })]])).toHaveLength(2);
  });

  it('normalizes formatting without removing meaningful punctuation or emoji joiners', () => {
    const preferred = comment({ text: '这是\u200b　ＦＸ\n战士' });
    const merged = mergeDanmakuComments([
      [preferred, comment({ text: '这是 FX 战士！' }), comment({ text: '👩\u200d💻' })],
      [comment({ text: '这是 FX 战士' }), comment({ text: '👩💻' })],
    ]);
    expect(merged.map((entry) => entry.text)).toEqual([
      preferred.text,
      '这是 FX 战士！',
      '👩\u200d💻',
      '👩💻',
    ]);
  });

  it('uses a bounded time interval without transitive time drift', () => {
    expect(
      mergeDanmakuComments([
        [comment({ timeInSeconds: 1.24 })],
        [comment({ timeInSeconds: 1.49 })],
        [comment({ timeInSeconds: 1.491 })],
      ]),
    ).toHaveLength(2);
    expect(
      mergeDanmakuComments([
        [comment({ timeInSeconds: 1 })],
        [comment({ timeInSeconds: 1.2 })],
        [comment({ timeInSeconds: 1.4 })],
      ]),
    ).toHaveLength(2);
  });

  it('pairs anonymous copies chronologically without consuming a later chant first', () => {
    const merged = mergeDanmakuComments([
      [comment({ user: '', timeInSeconds: 1 }), comment({ user: '', timeInSeconds: 1.2 })],
      [comment({ user: '', timeInSeconds: 1.35 }), comment({ user: '', timeInSeconds: 1.15 })],
    ]);
    expect(merged).toHaveLength(2);
  });

  it('returns chronological unique IDs without mutating input', () => {
    const late = Object.freeze(comment({ id: 10, timeInSeconds: 9 }));
    const early = Object.freeze(comment({ id: 10, timeInSeconds: 2 }));
    const source = Object.freeze([late, early]);
    const merged = mergeDanmakuComments([source]);
    expect(merged.map((entry) => [entry.id, entry.timeInSeconds])).toEqual([
      [1, 2],
      [2, 9],
    ]);
    expect(source).toEqual([late, early]);
    expect(source.map((entry) => entry.id)).toEqual([10, 10]);
  });
});
