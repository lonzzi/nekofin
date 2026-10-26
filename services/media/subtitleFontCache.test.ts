import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSubtitleFontCacheStore } from './subtitleFontCache';

const io = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  directories: new Map<string, number>(),
  download: vi.fn(),
  sequence: 0,
  list: vi.fn(),
}));
vi.mock('expo-mpv', () => ({
  decodeWoff2: vi.fn(async (_input: string, output: string) => {
    io.files.set(output, new Uint8Array([0, 1, 0, 0, 1, 2, 3, 4]));
  }),
}));
vi.mock('expo-crypto', async () => {
  const { createHash } = await import('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_: string, value: string) =>
      createHash('sha256').update(value).digest('hex'),
    randomUUID: () => `uuid-${++io.sequence}`,
  };
});
vi.mock('expo-file-system', () => {
  const uri = (parts: (string | { uri: string })[]) =>
    parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(parts);
    }
    get name() {
      return this.uri.split('/').at(-1)!;
    }
    get exists() {
      return io.files.has(this.uri);
    }
    get size() {
      return io.files.get(this.uri)?.length ?? 0;
    }
    async text() {
      return new TextDecoder().decode(io.files.get(this.uri)!);
    }
    write(text: string) {
      io.files.set(this.uri, new TextEncoder().encode(text));
    }
    delete() {
      io.files.delete(this.uri);
    }
    open() {
      return { readBytes: (count: number) => io.files.get(this.uri)!.slice(0, count), close() {} };
    }
    async copy(file: File) {
      io.files.set(file.uri, io.files.get(this.uri)!);
    }
    async move(file: File) {
      await this.copy(file);
      this.delete();
      this.uri = file.uri;
    }
    static downloadFileAsync = io.download;
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(parts);
    }
    get name() {
      return this.uri.split('/').at(-1)!;
    }
    get exists() {
      return io.directories.has(this.uri);
    }
    get size() {
      return [...io.files]
        .filter(([path]) => path.startsWith(this.uri + '/'))
        .reduce((sum, [, f]) => sum + f.length, 0);
    }
    info() {
      return { modificationTime: io.directories.get(this.uri) };
    }
    create() {
      if (!this.exists) io.directories.set(this.uri, Date.now());
    }
    delete() {
      for (const p of io.files.keys()) if (p.startsWith(this.uri + '/')) io.files.delete(p);
      io.directories.delete(this.uri);
    }
    list() {
      return [
        ...[...io.files.keys()]
          .filter(
            (p) => p.startsWith(this.uri + '/') && !p.slice(this.uri.length + 1).includes('/'),
          )
          .map((p) => new File(p)),
        ...[...io.directories.keys()]
          .filter(
            (p) => p.startsWith(this.uri + '/') && !p.slice(this.uri.length + 1).includes('/'),
          )
          .map((p) => new Directory(p)),
      ];
    }
  }
  return { File, Directory, Paths: { cache: 'file:///cache', bundle: 'file:///bundle' } };
});
vi.mock('./subtitleFonts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./subtitleFonts')>()),
  fetchFallbackFonts: (...args: unknown[]) => io.list(...args),
}));
const scope = { serverId: 'server', userId: 'user' };
const request = {
  api: { basePath: 'https://media.test', accessToken: 'secret-test-only' },
  type: 'jellyfin' as const,
  itemId: 'movie',
  source: { id: 'source', protocol: 'File', container: 'mkv', mediaStreams: [] },
};
const font = new Uint8Array([0, 1, 0, 0, 1, 2, 3, 4]);
let sessions: ReturnType<ReturnType<typeof createSubtitleFontCacheStore>['createSession']>[];
function session(store: ReturnType<typeof createSubtitleFontCacheStore>, override = {}) {
  const s = store.createSession({ ...scope, ...override });
  sessions.push(s);
  return s;
}
beforeEach(() => {
  io.files.clear();
  io.directories.clear();
  sessions = [];
  io.list
    .mockReset()
    .mockResolvedValue([{ Name: '字体.ttf', Size: font.length, DateModified: 'old' }]);
  io.download.mockReset().mockImplementation(async (_url, file) => {
    io.files.set(file.uri, font);
    return file;
  });
});
afterEach(() => {
  sessions.forEach((s) => s.dispose());
  vi.useRealTimers();
});

describe('persistent subtitle font cache', () => {
  it('shares detail/player work and survives a process restart without downloading again', async () => {
    const store = createSubtitleFontCacheStore();
    const [first, second] = await Promise.all([
      session(store).prepare(request),
      session(store).prepare(request),
    ]);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(io.download).toHaveBeenCalledOnce();
    expect(io.list).toHaveBeenCalledOnce();
    expect(await session(createSubtitleFontCacheStore()).prepare(request)).toBe(first);
    expect(io.download).toHaveBeenCalledOnce();
    expect(io.list).toHaveBeenCalledOnce();
    expect(io.download.mock.calls[0][2].headers).toEqual({ 'X-Emby-Token': 'secret-test-only' });
    expect([...io.files.values()].map((f) => new TextDecoder().decode(f)).join('')).not.toContain(
      'secret-test-only',
    );
  });
  it('isolates servers and accounts, and retains the bundled CJK fallback', async () => {
    io.files.set('file:///bundle/ExpoMpvFonts.bundle/NotoSansCJKsc-Regular.otf', font);
    const store = createSubtitleFontCacheStore();
    const dirs = await Promise.all([
      session(store).prepare(request),
      session(store, { serverId: 'other' }).prepare(request),
      session(store, { userId: 'other' }).prepare(request),
    ]);
    expect(new Set(dirs).size).toBe(3);
    for (const dir of dirs) expect(io.files.has(`${dir}/NotoSansCJKsc-Regular.otf`)).toBe(true);
  });
  it('rejects HTML responses and truncated font downloads, then retries', async () => {
    const store = createSubtitleFontCacheStore();
    io.download.mockImplementationOnce(async (_url, file) => {
      io.files.set(file.uri, new TextEncoder().encode('<html>'));
    });
    expect(await session(store).prepare(request)).toBeUndefined();
    expect(await session(store).prepare(request)).toBeTruthy();
    expect(io.download).toHaveBeenCalledTimes(2);
    expect([...io.files.keys()].some((p) => p.endsWith('.part'))).toBe(false);
  });
  it('uses cached fonts offline and refreshes a replaced server font after the list expires', async () => {
    vi.useFakeTimers();
    const store = createSubtitleFontCacheStore();
    const first = await session(store).prepare(request);
    vi.advanceTimersByTime(61 * 60 * 1000);
    io.list.mockRejectedValueOnce(new Error('offline'));
    expect(await session(store).prepare(request)).toBe(first);
    io.list.mockResolvedValueOnce([{ Name: '字体.ttf', Size: font.length, DateModified: 'new' }]);
    expect(await session(store).prepare(request)).not.toBe(first);
    expect(io.download).toHaveBeenCalledTimes(2);
  });
  it('keeps active font files during clear and removes them when playback releases the lease', async () => {
    const store = createSubtitleFontCacheStore();
    const s = session(store);
    const dir = await s.prepare(request);
    await store.clear();
    expect(io.files.has(`${dir}/0.ttf`)).toBe(true);
    s.dispose();
    await store.prune();
    expect(io.files.has(`${dir}/0.ttf`)).toBe(false);
    expect(await session(store).prepare(request)).toBeTruthy();
    expect(io.download).toHaveBeenCalledTimes(2);
  });
  it('does not publish an aborted download after clearing the cache', async () => {
    const store = createSubtitleFontCacheStore();
    io.download.mockImplementation(
      (_url, _file, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );
    const pending = session(store).prepare(request);
    await vi.waitFor(() => expect(io.download).toHaveBeenCalledOnce());
    await store.clear();
    expect(await pending).toBeUndefined();
  });
  it('loads Emby font attachments even when no fallback-font endpoint exists', async () => {
    const source = { ...request.source, mediaAttachments: [{ index: 0, fileName: 'font.otf' }] };
    expect(
      await session(createSubtitleFontCacheStore()).prepare({ ...request, type: 'emby', source }),
    ).toBeTruthy();
    expect(io.list).not.toHaveBeenCalled();
  });
  it('decodes WOFF2 once and reuses the native font after a process restart', async () => {
    const { decodeWoff2 } = await import('expo-mpv');
    vi.mocked(decodeWoff2).mockClear();
    io.list.mockResolvedValue([{ Name: 'font.woff2', Size: 8 }]);
    io.download.mockImplementation(async (_url, file) => {
      io.files.set(file.uri, new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4]));
    });
    const dir = await session(createSubtitleFontCacheStore()).prepare(request);
    expect(dir).toBeTruthy();
    expect(io.files.has(`${dir}/0.ttf`)).toBe(true);
    expect(await session(createSubtitleFontCacheStore()).prepare(request)).toBe(dir);
    expect(decodeWoff2).toHaveBeenCalledOnce();
    expect(io.download).toHaveBeenCalledOnce();
  });
  it('prepares a local custom choice without waiting for the server and retains server fonts', async () => {
    io.files.set('file:///documents/custom.ttf', font);
    const customFont = {
      name: 'custom.ttf',
      revision: 'custom-1',
      url: 'file:///documents/custom.ttf',
      size: font.length,
    };
    const store = createSubtitleFontCacheStore();
    const local = await session(store).prepare({ ...request, customFont, localOnly: true });
    expect(io.list).not.toHaveBeenCalled();
    expect(io.download).not.toHaveBeenCalled();
    expect(io.files.has(`${local}/0.ttf`)).toBe(true);
    const combined = await session(store).prepare({ ...request, customFont });
    expect(combined).not.toBe(local);
    expect(io.files.has(`${combined}/0.ttf`)).toBe(true);
    expect(io.files.has(`${combined}/1.ttf`)).toBe(true);
    expect(io.download).toHaveBeenCalledOnce();
    await store.clear();
    expect(io.files.has('file:///documents/custom.ttf')).toBe(true);
  });
});
