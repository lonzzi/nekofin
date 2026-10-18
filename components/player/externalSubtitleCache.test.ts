import {
  createSubtitleCacheStore,
  SUBTITLE_CACHE_MAX_AGE_MS,
} from '@/services/media/subtitleCache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
  files: new Map<string, { text: string; size: number }>(),
  directories: new Set<string>(),
  download: vi.fn(),
  sequence: 0,
}));
vi.mock('expo-crypto', async () => {
  const { createHash } = await import('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, value: string) =>
      createHash('sha256').update(value).digest('hex'),
    randomUUID: () => `uuid-${++io.sequence}`,
  };
});
vi.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return io.files.has(this.uri);
    }
    get name() {
      return this.uri.split('/').at(-1)!;
    }
    get size() {
      return io.files.get(this.uri)?.size ?? 0;
    }
    async text() {
      return io.files.get(this.uri)!.text;
    }
    write(text: string) {
      io.files.set(this.uri, { text, size: text.length });
    }
    delete() {
      io.files.delete(this.uri);
    }
    async move(file: File) {
      io.files.set(file.uri, io.files.get(this.uri)!);
      io.files.delete(this.uri);
      this.uri = file.uri;
    }
    static downloadFileAsync = io.download;
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    create() {
      io.directories.add(this.uri);
    }
    list() {
      return [...io.files.keys()]
        .filter(
          (uri) => uri.startsWith(this.uri + '/') && !uri.slice(this.uri.length + 1).includes('/'),
        )
        .map((uri) => new File(uri));
    }
  }
  return { File, Directory, Paths: { cache: 'file:///cache' } };
});
const scope = {
  serverId: 'server',
  userId: 'user',
  itemId: 'movie',
  mediaSourceId: 'source',
  sourceSize: 1234,
};
const track = {
  index: 8,
  name: '简体中文 ASS',
  language: 'zh-CN',
  url: 'https://media.test/emby/Videos/movie/source/Subtitles/8/0/Stream.ass?api_key=test-only',
};
const active = () => true;
let sessions: ReturnType<ReturnType<typeof createSubtitleCacheStore>['createSession']>[] = [];
function session(store: ReturnType<typeof createSubtitleCacheStore>, overrides = {}) {
  const value = store.createSession({ ...scope, ...overrides });
  sessions.push(value);
  return value;
}
function completeFile(file: { uri: string }, size = 100) {
  io.files.set(file.uri, { text: '[Script Info]', size });
  return file;
}
function delayedDownload() {
  const pending: { complete: () => void; signal: AbortSignal }[] = [];
  io.download.mockImplementation(
    (_url, file, { signal }) =>
      new Promise((resolve, reject) => {
        pending.push({ signal, complete: () => resolve(completeFile(file)) });
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
  );
  return pending;
}

describe('shared external subtitle cache', () => {
  beforeEach(() => {
    io.files.clear();
    io.directories.clear();
    io.sequence = 0;
    sessions = [];
    io.download.mockReset().mockImplementation(async (_url, file) => completeFile(file));
  });
  afterEach(() => {
    sessions.forEach((cache) => cache.dispose());
    vi.useRealTimers();
  });

  it('reuses a complete file after leaving playback and after a process restart', async () => {
    const first = session(createSubtitleCacheStore());
    const prepared = await first.prepare(track, active);
    expect(prepared?.url).toMatch(/\/[a-f0-9]{64}\.ass$/);
    expect(prepared?.url).not.toContain('test-only');
    first.dispose();
    const second = session(createSubtitleCacheStore());
    expect(await second.prepare(track, active)).toEqual(prepared);
    expect(io.download).toHaveBeenCalledOnce();
  });

  it.each(['sup', 'pgs', 'pgssub'])(
    'caches a large %s bitmap subtitle unchanged',
    async (format) => {
      io.download.mockImplementation(async (_url, file) => completeFile(file, 83_594_085));
      const pgs = { ...track, url: `https://media.test/Stream.${format}` };
      const first = session(createSubtitleCacheStore());
      const prepared = await first.prepare(pgs, active);
      expect(prepared?.url).toMatch(/\/[a-f0-9]{64}\.sup$/);
      expect(io.files.get(prepared!.url)?.size).toBe(83_594_085);
      first.dispose();
      expect(await session(createSubtitleCacheStore()).prepare(pgs, active)).toEqual(prepared);
      expect(io.download).toHaveBeenCalledOnce();
    },
  );

  it('shares a file across LAN/WAN addresses and rotated tokens, while isolating accounts and versions', async () => {
    const store = createSubtitleCacheStore();
    const first = await session(store).prepare(track, active);
    const routed = {
      ...track,
      url: 'http://lan.test/jellyfin/Videos/movie/source/Subtitles/8/0/Stream.ass?api_key=new-token',
    };
    expect((await session(store).prepare(routed, active))?.url).toBe(first?.url);
    for (const override of [
      { userId: 'other' },
      { serverId: 'other' },
      { mediaSourceId: 'other' },
      { sourceSize: 4321 },
    ])
      expect((await session(store, override).prepare(track, active))?.url).not.toBe(first?.url);
    expect(io.download).toHaveBeenCalledTimes(5);
    expect(JSON.stringify([...io.files])).not.toContain('test-only');
  });

  it('deduplicates detail/player requests and keeps the shared request alive when one consumer leaves', async () => {
    const pending = delayedDownload();
    const store = createSubtitleCacheStore();
    const detail = session(store);
    const player = session(store);
    const a = detail.prepare(track, active);
    const b = player.prepare(track, active);
    await vi.waitFor(() => expect(io.download).toHaveBeenCalledOnce());
    detail.dispose();
    expect(pending[0].signal.aborted).toBe(false);
    pending[0].complete();
    expect(await a).toBeUndefined();
    expect(await b).toMatchObject({ index: 8 });
  });

  it('cancels work when the last consumer exits and removes partial Android downloads', async () => {
    const pending = delayedDownload();
    const store = createSubtitleCacheStore();
    const cache = session(store);
    const loading = cache.prepare(track, active);
    await vi.waitFor(() => expect(io.download).toHaveBeenCalledOnce());
    cache.dispose();
    expect(pending[0].signal.aborted).toBe(true);
    await expect(loading).resolves.toBeUndefined();
    expect(io.files.size).toBe(0);
  });

  it('does not publish stale results or begin work for an inactive consumer', async () => {
    const store = createSubtitleCacheStore();
    const cache = session(store);
    await expect(cache.prepare(track, () => false)).resolves.toBeUndefined();
    const pending = cache.prepare(track, active);
    cache.dispose();
    await expect(pending).resolves.toBeUndefined();
    expect(io.download).not.toHaveBeenCalled();
  });

  it('does not cache HTTP failures, partial files or empty downloads and allows retry', async () => {
    const cache = session(createSubtitleCacheStore());
    io.download.mockImplementationOnce(async (_url, file) => {
      completeFile(file);
      throw new Error('HTTP 403');
    });
    await expect(cache.prepare(track, active)).rejects.toThrow('HTTP 403');
    expect(io.files.size).toBe(0);
    io.download.mockImplementationOnce(async (_url, file) => completeFile(file, 0));
    await expect(cache.prepare(track, active)).rejects.toThrow('Empty subtitle');
    expect(io.files.size).toBe(0);
    await expect(cache.prepare(track, active)).resolves.toMatchObject({ index: 8 });
  });

  it('detects OS-evicted files instead of returning a missing local path', async () => {
    const store = createSubtitleCacheStore();
    const first = session(store);
    const prepared = await first.prepare(track, active);
    first.dispose();
    io.files.delete(prepared!.url);
    await session(store).prepare(track, active);
    expect(io.download).toHaveBeenCalledTimes(2);
  });

  it('expires old files but protects a file held by the current player', async () => {
    vi.useFakeTimers();
    const store = createSubtitleCacheStore();
    const first = session(store);
    const prepared = await first.prepare(track, active);
    await vi.advanceTimersByTimeAsync(SUBTITLE_CACHE_MAX_AGE_MS + 1);
    await store.prune();
    expect(io.files.has(prepared!.url)).toBe(true);
    first.dispose();
    await store.prune();
    expect(io.files.has(prepared!.url)).toBe(false);
    await session(store).prepare(track, active);
    expect(io.download).toHaveBeenCalledTimes(2);
  });

  it('evicts least recently used unleased files to enforce the disk budget', async () => {
    vi.useFakeTimers();
    const store = createSubtitleCacheStore({ maxBytes: 200 });
    const first = session(store);
    const a = await first.prepare(track, active);
    first.dispose();
    await vi.advanceTimersByTimeAsync(1);
    const second = session(store);
    const b = await second.prepare({ ...track, index: 9 }, active);
    second.dispose();
    await vi.advanceTimersByTimeAsync(1);
    const touch = session(store);
    await touch.prepare(track, active);
    touch.dispose();
    await vi.advanceTimersByTimeAsync(1);
    await session(store).prepare({ ...track, index: 10 }, active);
    await store.prune();
    expect(io.files.has(a!.url)).toBe(true);
    expect(io.files.has(b!.url)).toBe(false);
  });

  it('limits concurrent downloads across independent detail pages', async () => {
    const pending = delayedDownload();
    const store = createSubtitleCacheStore();
    const promises = [8, 9, 10].map((index) => session(store).prepare({ ...track, index }, active));
    await vi.waitFor(() => expect(io.download).toHaveBeenCalledTimes(2));
    pending[0].complete();
    await vi.waitFor(() => expect(io.download).toHaveBeenCalledTimes(3));
    pending[1].complete();
    pending[2].complete();
    expect((await Promise.all(promises)).every(Boolean)).toBe(true);
  });

  it('clears unused files, defers active-player removal, and does not restart old prefetch sessions', async () => {
    const store = createSubtitleCacheStore();
    const cache = session(store);
    const prepared = await cache.prepare(track, active);
    await store.clear();
    expect(io.files.has(prepared!.url)).toBe(true);
    await expect(cache.prepare({ ...track, index: 9 }, active)).resolves.toBeUndefined();
    cache.dispose();
    await store.prune();
    expect(io.files.size).toBe(0);
    await session(store).prepare(track, active);
    expect(io.download).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending clear without committing a partial file', async () => {
    const pending = delayedDownload();
    const store = createSubtitleCacheStore();
    const loading = session(store).prepare(track, active);
    await vi.waitFor(() => expect(io.download).toHaveBeenCalledOnce());
    await store.clear();
    expect(pending[0].signal.aborted).toBe(true);
    await expect(loading).resolves.toBeUndefined();
    expect(io.files.size).toBe(0);
  });

  it('allows a large ASS download beyond thirty seconds but aborts a hung request at two minutes', async () => {
    vi.useFakeTimers();
    const pending = delayedDownload();
    const store = createSubtitleCacheStore();
    const cache = session(store);
    const loading = cache.prepare(track, active);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(pending[0].signal.aborted).toBe(false);
    pending[0].complete();
    await expect(loading).resolves.toMatchObject({ index: 8 });
    expect(vi.getTimerCount()).toBe(0);
    const hanging = cache.prepare({ ...track, index: 9 }, active);
    const assertion = expect(hanging).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
