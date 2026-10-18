import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CUSTOM_SUBTITLE_FONTS_KEY,
  customSubtitleFontFile,
  importCustomSubtitleFont,
  normalizeFontUrl,
  parseCustomSubtitleFonts,
  removeCustomSubtitleFont,
  selectCustomSubtitleFont,
} from './customSubtitleFonts';

const state = vi.hoisted(() => ({
  directory: '',
  values: new Map<string, string>(),
  fetch: vi.fn(),
  families: vi.fn(),
  decode: vi.fn(),
}));
vi.mock('@/lib/storage', () => ({
  storage: {
    getString: (key: string) => state.values.get(key),
    set: (key: string, value: string) => state.values.set(key, value),
  },
}));
vi.mock('expo-mpv', () => ({
  fontFamilies: state.families,
  decodeWoff2: state.decode,
}));
vi.mock('expo-crypto', async () => ({ randomUUID: (await import('node:crypto')).randomUUID }));
vi.mock('expo-file-system', async () => {
  const fs = await import('node:fs');
  const path = (...parts: (string | { uri: string })[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : p.uri))
      .join('/')
      .replace(/^file:\/\//, '');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = `file://${path(...parts)}`;
    }
    static async downloadFileAsync(
      url: string,
      file: File,
      options: {
        signal: AbortSignal;
        onProgress: (progress: { bytesWritten: number; totalBytes: number }) => void;
      },
    ) {
      const response: Response = await state.fetch(url);
      if (!response.ok) throw new Error('HTTP error');
      options.onProgress({
        bytesWritten: 0,
        totalBytes: Number(response.headers.get('Content-Length')),
      });
      if (options.signal.aborted) throw new Error('aborted');
      const data = new Uint8Array(await response.arrayBuffer());
      fs.writeFileSync(path(file), data);
      options.onProgress({ bytesWritten: data.length, totalBytes: data.length });
      if (options.signal.aborted) throw new Error('aborted');
      return file;
    }
    get exists() {
      return fs.existsSync(path(this));
    }
    get size() {
      return this.exists ? fs.statSync(path(this)).size : 0;
    }
    create() {
      fs.writeFileSync(path(this), '');
    }
    delete() {
      fs.unlinkSync(path(this));
    }
    copy(destination: File) {
      fs.copyFileSync(path(this), path(destination));
    }
    move(destination: File) {
      fs.renameSync(path(this), path(destination));
      this.uri = destination.uri;
    }
    open() {
      const fd = fs.openSync(path(this), 'r+');
      let offset = 0;
      return {
        readBytes(length: number) {
          const bytes = new Uint8Array(length);
          const count = fs.readSync(fd, bytes, 0, length, offset);
          offset += count;
          return bytes.slice(0, count);
        },
        writeBytes(bytes: Uint8Array) {
          fs.writeSync(fd, bytes, 0, bytes.length, offset);
          offset += bytes.length;
        },
        close() {
          fs.closeSync(fd);
        },
      };
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = `file://${path(...parts)}`;
    }
    create() {
      fs.mkdirSync(path(this), { recursive: true });
    }
  }
  return {
    File,
    Directory,
    Paths: {
      get document() {
        return state.directory;
      },
    },
  };
});
const bytes = new Uint8Array([0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
const settings = () => parseCustomSubtitleFonts(state.values.get(CUSTOM_SUBTITLE_FONTS_KEY));
const NativeAbortController = globalThis.AbortController;
beforeEach(() => {
  // React Native's AbortSignal does not implement throwIfAborted.
  vi.stubGlobal(
    'AbortController',
    class extends NativeAbortController {
      constructor() {
        super();
        Object.defineProperty(this.signal, 'throwIfAborted', { value: undefined });
      }
    },
  );
  state.directory = mkdtempSync(join(tmpdir(), 'nekofin-font-import-'));
  state.values.clear();
  state.families.mockReset().mockResolvedValue(['实际字体', 'Second Family']);
  state.fetch.mockReset().mockImplementation(async () => new Response(bytes));
  state.decode
    .mockReset()
    .mockImplementation(async (_input: string, output: string) =>
      writeFileSync(output.replace(/^file:\/\//, ''), bytes),
    );
});
afterEach(() => {
  rmSync(state.directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('custom subtitle font imports', () => {
  it('owns a permanent copy, uses embedded families and persists a selection', async () => {
    const source = join(state.directory, 'upload.ttf');
    writeFileSync(source, bytes);
    const font = await importCustomSubtitleFont({
      uri: `file://${source}`,
      name: '../../upload.ttf',
    });
    rmSync(source);
    expect(font.name).toBe('upload.ttf');
    expect(settings().selection).toEqual({ id: font.id, family: '实际字体' });
    expect(settings().fonts).toEqual([font]);
    expect(readFileSync(customSubtitleFontFile(font).uri.replace(/^file:\/\//, ''))).toEqual(
      Buffer.from(bytes),
    );
    expect(state.fetch).not.toHaveBeenCalled();
    selectCustomSubtitleFont({ id: font.id, family: 'Second Family' });
    expect(settings().selection?.family).toBe('Second Family');
    selectCustomSubtitleFont({ id: font.id, family: 'missing' });
    expect(settings().selection?.family).toBe('Second Family');
    removeCustomSubtitleFont(font.id);
    expect(settings()).toEqual({ fonts: [], selection: undefined });
    expect(customSubtitleFontFile(font).exists).toBe(false);
  });
  it('accepts extensionless URLs, does not persist URL secrets and decodes WOFF2 once', async () => {
    state.fetch.mockResolvedValue(new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32, ...bytes])));
    const font = await importCustomSubtitleFont({
      uri: 'https://font.test/download?token=not-persisted',
    });
    expect(font.extension).toBe('ttf');
    expect(font.name).toBe('实际字体');
    expect(state.decode).toHaveBeenCalledOnce();
    expect(state.values.get(CUSTOM_SUBTITLE_FONTS_KEY)).not.toContain('not-persisted');
    expect(customSubtitleFontFile(font).exists).toBe(true);
    selectCustomSubtitleFont();
    expect(settings().selection).toBeUndefined();
    expect(settings().fonts).toHaveLength(1);
  });
  it('rejects HTML, malformed names and oversized downloads without saving a choice', async () => {
    state.fetch.mockResolvedValueOnce(new Response('<html>this is not a font</html>'));
    await expect(importCustomSubtitleFont({ uri: 'https://font.test/font' })).rejects.toThrow(
      '字体文件',
    );
    state.families.mockRejectedValueOnce(new Error('bad name table'));
    await expect(importCustomSubtitleFont({ uri: 'https://font.test/font' })).rejects.toThrow(
      '完整有效',
    );
    state.fetch.mockResolvedValueOnce(
      new Response(bytes, { headers: { 'Content-Length': `${33 * 1024 * 1024}` } }),
    );
    await expect(importCustomSubtitleFont({ uri: 'https://font.test/font' })).rejects.toThrow(
      '32 MB',
    );
    expect(settings().fonts).toEqual([]);
  });
  it('does not commit an import cancelled during native inspection', async () => {
    const controller = new AbortController();
    state.families.mockImplementationOnce(async () => {
      controller.abort();
      return ['A'];
    });
    await expect(
      importCustomSubtitleFont({ uri: 'https://font.test/font', signal: controller.signal }),
    ).rejects.toThrow();
    expect(settings().fonts).toEqual([]);
  });
  it('ignores corrupt settings, traversal IDs and selections without a matching family', () => {
    expect(parseCustomSubtitleFonts('broken')).toEqual({ fonts: [] });
    expect(
      parseCustomSubtitleFonts(
        JSON.stringify({ fonts: [{ id: '../font' }], selection: { id: '../font', family: 'A' } }),
      ),
    ).toEqual({ fonts: [], selection: undefined });
    expect(() => normalizeFontUrl('file:///tmp/font.ttf')).toThrow();
    expect(() => normalizeFontUrl('https://user:pass@font.test/font')).toThrow();
    expect(normalizeFontUrl(' https://font.test/font#foo ')).toBe('https://font.test/font');
  });
});
