import { describe, expect, it } from 'vitest';

import { getTrickplayFrame, getTrickplayManifest, getTrickplayTileUrl } from './trickplay';

const small = {
  Width: 160,
  Height: 90,
  TileWidth: 5,
  TileHeight: 5,
  ThumbnailCount: 53,
  Interval: 10000,
};
const large = { ...small, Width: 320, Height: 180 };
const raw = {
  Id: 'first',
  Trickplay: { first: { 160: small, 320: large }, second: { 160: { ...small, Interval: 5000 } } },
};

describe('player trickplay', () => {
  it('uses the playing version and an appropriately sized preview', () => {
    expect(getTrickplayManifest(raw, 'first')).toEqual({ ...large, mediaSourceId: 'first' });
    expect(getTrickplayManifest(raw, 'second')?.Interval).toBe(5000);
    expect(getTrickplayManifest(raw, 'missing')).toBeNull();
    expect(getTrickplayManifest(raw)?.mediaSourceId).toBe('first');
    expect(getTrickplayManifest({ Trickplay: raw.Trickplay })).toBeNull();
  });
  it('falls back cleanly for missing or malformed server metadata', () => {
    expect(getTrickplayManifest(null)).toBeNull();
    expect(getTrickplayManifest({ Trickplay: {} })).toBeNull();
    expect(
      getTrickplayManifest({ Trickplay: { a: { 160: { ...small, Interval: 0 } } } }),
    ).toBeNull();
    expect(
      getTrickplayManifest({ Trickplay: { a: { 160: { ...small, TileWidth: Infinity } } } }),
    ).toBeNull();
    expect(getTrickplayManifest({ Trickplay: { a: { 160: small } } })).toEqual({
      ...small,
      mediaSourceId: 'a',
    });
  });
  it('crops the correct row, column and tile, including the final partial tile', () => {
    const info = getTrickplayManifest(raw, 'first')!;
    expect(getTrickplayFrame(info, 0)).toEqual({ tileIndex: 0, row: 0, column: 0 });
    expect(getTrickplayFrame(info, 249999)).toEqual({ tileIndex: 0, row: 4, column: 4 });
    expect(getTrickplayFrame(info, 250000)).toEqual({ tileIndex: 1, row: 0, column: 0 });
    expect(getTrickplayFrame(info, 9999999)).toEqual({ tileIndex: 2, row: 0, column: 2 });
    expect(getTrickplayFrame(info, -1)).toEqual({ tileIndex: 0, row: 0, column: 0 });
    expect(getTrickplayFrame(info, NaN)).toEqual({ tileIndex: 0, row: 0, column: 0 });
  });
  it('preserves the server base path and scopes tile URLs to the media version', () => {
    expect(
      getTrickplayTileUrl(
        'https://media.example/jellyfin/',
        'a/b',
        { ...large, mediaSourceId: 'v/2' },
        1,
      ),
    ).toBe('https://media.example/jellyfin/Videos/a%2Fb/Trickplay/320/1.jpg?mediaSourceId=v%2F2');
  });
});
