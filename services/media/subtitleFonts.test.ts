import { afterEach, describe, expect, it, vi } from 'vitest';

import { mapMediaSource } from './mappers';
import { deriveSubtitleFonts, fetchFallbackFonts, parseFallbackFonts } from './subtitleFonts';

const api = { basePath: 'https://media.test/jellyfin', accessToken: 'test-only' };
const source = mapMediaSource({
  Id: 'source',
  Size: 100,
  MediaAttachments: [
    {
      Index: 0,
      FileName: '中文 字体.otf',
      DeliveryUrl: '/jellyfin/Videos/movie/source/Attachments/0',
    },
    { Index: 3, FileName: 'cover.jpg' },
    { Index: 4, FileName: 'font.ttf', DeliveryUrl: 'https://other.test/font.ttf' },
    { Index: 5, FileName: 'font.woff2' },
  ],
});
afterEach(() => vi.unstubAllGlobals());

describe('server subtitle fonts', () => {
  it('preserves font attachments in the shared playback mapper', () => {
    expect(source.mediaAttachments?.[0]).toEqual({
      index: 0,
      fileName: '中文 字体.otf',
      deliveryUrl: '/jellyfin/Videos/movie/source/Attachments/0',
    });
  });
  it('uses authenticated fallback requests without putting credentials in URLs', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ Name: '中文 字体.woff2', Size: 100 }])));
    vi.stubGlobal('fetch', request);
    expect(await fetchFallbackFonts(api, new AbortController().signal)).toHaveLength(1);
    expect(request.mock.calls[0]).toEqual([
      'https://media.test/jellyfin/FallbackFont/Fonts',
      { headers: { 'X-Emby-Token': 'test-only' }, signal: expect.any(AbortSignal) },
    ]);
  });
  it('builds prefixed font URLs and rejects attachments on other origins', () => {
    const fonts = deriveSubtitleFonts(api, 'jellyfin', 'movie', source, [
      { Name: '中文 字体.woff2', Size: 100, DateModified: 'v1' },
    ]);
    expect(fonts).toHaveLength(3);
    expect(fonts[0].url).toBe(
      'https://media.test/jellyfin/FallbackFont/Fonts/%E4%B8%AD%E6%96%87%20%E5%AD%97%E4%BD%93.woff2',
    );
    expect(fonts[1].url).toBe('https://media.test/jellyfin/Videos/movie/source/Attachments/0');
    expect(fonts[2].url).toBe('https://media.test/jellyfin/Videos/movie/source/Attachments/5');
    expect(JSON.stringify(fonts)).not.toContain('test-only');
  });
  it('supports Emby attachments without requesting a Jellyfin-only endpoint', () => {
    expect(
      deriveSubtitleFonts(api, 'emby', 'movie', source, [{ Name: 'fallback.ttf', Size: 10 }]),
    ).toHaveLength(2);
  });
  it('invalidates the font revision when the server replaces the font', () => {
    const font = { Name: 'font.ttf', Size: 100, DateModified: 'old' };
    const before = deriveSubtitleFonts(api, 'jellyfin', 'movie', source, [font]);
    const after = deriveSubtitleFonts(api, 'jellyfin', 'movie', source, [
      { ...font, DateModified: 'new' },
    ]);
    expect(before[0].revision).not.toBe(after[0].revision);
  });
  it('ignores malformed font lists and handles unsupported servers', async () => {
    expect(
      parseFallbackFonts([
        null,
        { Name: '../font.ttf', Size: 1 },
        { Name: 'font.ttf', Size: -1 },
        { Name: 'font.ttf', Size: 40 * 1024 * 1024 },
        { Name: 'font.jpg', Size: 100 },
      ]),
    ).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await fetchFallbackFonts(api, new AbortController().signal)).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(fetchFallbackFonts(api, new AbortController().signal)).rejects.toThrow();
  });
});
