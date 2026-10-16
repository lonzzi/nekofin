import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createExternalSubtitleCache } from './externalSubtitleCache';

const io = vi.hoisted(() => ({
  files: new Set<string>(),
  removed: [] as string[],
  download: vi.fn(),
  sequence: 0,
}));

vi.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++io.sequence}` }));
vi.mock('expo-file-system', () => {
  class Entry {
    uri: string;
    constructor(...parts: (string | Entry)[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return io.files.has(this.uri);
    }
    create() {
      io.files.add(this.uri);
    }
    delete() {
      io.removed.push(this.uri);
      for (const uri of io.files)
        if (uri === this.uri || uri.startsWith(`${this.uri}/`)) io.files.delete(uri);
    }
  }
  class File extends Entry {
    static downloadFileAsync = io.download;
  }
  return { Directory: Entry, File, Paths: { cache: 'file:///cache' } };
});

const track = {
  index: 8,
  name: '简体中文 ASS',
  language: 'zh-CN',
  url: 'https://media.test/emby/Videos/movie/source/Subtitles/8/0/Stream.ass?api_key=test-only',
};

describe('external subtitle cache', () => {
  beforeEach(() => {
    io.files.clear();
    io.removed.length = 0;
    io.sequence = 0;
    io.download.mockReset();
    io.download.mockImplementation(async (_url, file) => {
      io.files.add(file.uri);
      return file;
    });
  });
  afterEach(() => vi.useRealTimers());

  it('passes a system-downloaded local file to mpv and deletes it on playback exit', async () => {
    const cache = createExternalSubtitleCache();
    const prepared = await cache.prepare(track, () => true);
    expect(prepared).toEqual({
      ...track,
      url: 'file:///cache/player-subtitles/uuid-1/8-uuid-2.ass',
    });
    expect(io.download).toHaveBeenCalledWith(
      track.url,
      expect.objectContaining({ uri: prepared?.url }),
      {
        signal: expect.any(AbortSignal),
      },
    );
    expect(prepared?.url).not.toContain('test-only');
    expect(io.files.has(prepared!.url)).toBe(true);
    cache.dispose();
    expect(io.files.size).toBe(0);
  });

  it('removes a partial Android download and propagates real HTTP failures', async () => {
    io.download.mockImplementation(async (_url, file) => {
      io.files.add(file.uri);
      throw new Error('HTTP 403');
    });
    const cache = createExternalSubtitleCache();
    await expect(cache.prepare(track, () => true)).rejects.toThrow('HTTP 403');
    expect([...io.files].some((uri) => uri.endsWith('.ass'))).toBe(false);
    cache.dispose();
  });

  it('aborts in-flight downloads and discards late results after switching sources', async () => {
    let complete!: () => void;
    let signal!: AbortSignal;
    io.download.mockImplementation((_url, file, options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        complete = () => {
          io.files.add(file.uri);
          resolve(file);
        };
      });
    });
    const cache = createExternalSubtitleCache();
    const pending = cache.prepare(track, () => true);
    cache.dispose();
    expect(signal.aborted).toBe(true);
    complete();
    await expect(pending).resolves.toBeUndefined();
    expect(io.files.size).toBe(0);
    await expect(cache.prepare(track, () => true)).resolves.toBeUndefined();
    expect(io.download).toHaveBeenCalledTimes(1);
  });

  it('does not download stale work and discards downloads whose player became inactive', async () => {
    const cache = createExternalSubtitleCache();
    await expect(cache.prepare(track, () => false)).resolves.toBeUndefined();
    expect(io.download).not.toHaveBeenCalled();
    let active = true;
    io.download.mockImplementation(async (_url, file) => {
      io.files.add(file.uri);
      active = false;
      return file;
    });
    await expect(cache.prepare(track, () => active)).resolves.toBeUndefined();
    expect([...io.files].some((uri) => uri.endsWith('.ass'))).toBe(false);
    cache.dispose();
  });

  it('cancels a hung network request within the subtitle loading timeout', async () => {
    vi.useFakeTimers();
    io.download.mockImplementation(
      (_url, _file, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Download aborted')), {
            once: true,
          });
        }),
    );
    const cache = createExternalSubtitleCache();
    const assertion = expect(cache.prepare(track, () => true)).rejects.toThrow('Download aborted');
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    cache.dispose();
    expect(io.files.size).toBe(0);
  });
});
