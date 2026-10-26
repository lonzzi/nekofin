import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeWoff2 } from 'expo-mpv';

import {
  BUNDLED_SUBTITLE_FONT_DIRECTORY,
  deriveSubtitleFonts,
  fetchFallbackFonts,
  fontExtension,
  parseFallbackFonts,
  SUBTITLE_FONT_MAX_BYTES,
  type FallbackFont,
  type SubtitleFont,
} from './subtitleFonts';
import type { MediaApi, MediaServerType, MediaSource } from './types';

export const SUBTITLE_FONT_CACHE_PATH = 'nekofin/subtitle-fonts/v1';
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const LIST_MAX_AGE = 60 * 60 * 1000;
type Scope = { serverId: string; userId: string };
type Request = Scope & {
  api: MediaApi;
  type: MediaServerType;
  itemId: string;
  source: MediaSource;
  customFont?: SubtitleFont;
  localOnly?: boolean;
};
const hash = (value: unknown) =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify(value));

function isFont(file: File, expectedSize?: number) {
  if (
    !file.exists ||
    file.size <= 0 ||
    file.size > SUBTITLE_FONT_MAX_BYTES ||
    (expectedSize != null && file.size !== expectedSize)
  )
    return false;
  const handle = file.open();
  try {
    const signature = [...handle.readBytes(4)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return ['00010000', '4f54544f', '74746366', '74727565', '774f4646', '774f4632'].includes(
      signature,
    );
  } finally {
    handle.close();
  }
}

export function createSubtitleFontCacheStore() {
  const root = new Directory(Paths.cache, SUBTITLE_FONT_CACHE_PATH);
  const jobs = new Map<
    string,
    { promise: Promise<string | undefined>; controller: AbortController }
  >();
  const leases = new Map<string, Set<symbol>>();
  const pendingRemoval = new Set<string>();
  const lists = new Map<string, Promise<FallbackFont[]>>();
  let generation = 0;
  let initialized = false;

  async function prune(clear = false) {
    if (!root.exists) return;
    const directories = root.list().filter((file): file is Directory => file instanceof Directory);
    let bytes = directories.reduce((sum, directory) => sum + (directory.size ?? 0), 0);
    directories.sort((a, b) => (a.info().modificationTime ?? 0) - (b.info().modificationTime ?? 0));
    for (const directory of directories) {
      if (clear) pendingRemoval.add(directory.name);
      if (leases.get(directory.name)?.size) continue;
      if (
        pendingRemoval.has(directory.name) ||
        bytes > MAX_CACHE_BYTES ||
        Date.now() - (directory.info().modificationTime ?? 0) > MAX_AGE
      ) {
        bytes -= directory.size ?? 0;
        directory.delete();
        pendingRemoval.delete(directory.name);
      }
    }
    if (clear) for (const file of root.list()) if (file instanceof File) file.delete();
  }

  async function fallbackFonts(key: string, api: MediaApi) {
    let pending = lists.get(key);
    if (!pending) {
      pending = (async () => {
        const manifest = new File(root, `${key}.json`);
        let cached: FallbackFont[] = [];
        try {
          const data = JSON.parse(await manifest.text());
          cached = parseFallbackFonts(data.fonts);
          if (Date.now() - data.checkedAt < LIST_MAX_AGE) return cached;
        } catch {
          /* Missing or invalid manifests are refreshed from the server. */
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const requestedGeneration = generation;
        try {
          const fonts = await fetchFallbackFonts(api, controller.signal);
          if (requestedGeneration === generation)
            manifest.write(JSON.stringify({ checkedAt: Date.now(), fonts }));
          return fonts;
        } catch {
          return cached;
        } finally {
          clearTimeout(timeout);
        }
      })();
      lists.set(key, pending);
      void pending
        .finally(() => {
          if (lists.get(key) === pending) lists.delete(key);
        })
        .catch(() => {});
    }
    return pending;
  }

  async function download(
    directory: Directory,
    fonts: SubtitleFont[],
    api: MediaApi,
    signal: AbortSignal,
  ) {
    directory.create({ intermediates: true, idempotent: true });
    const fontsDirectory = new Directory(directory, 'fonts');
    fontsDirectory.create({ intermediates: true, idempotent: true });
    // Preserve the native module's CJK fallback when libass switches to this directory.
    const fallback = new File(
      Paths.bundle,
      BUNDLED_SUBTITLE_FONT_DIRECTORY,
      'NotoSansCJKsc-Regular.otf',
    );
    const bundled = new File(fontsDirectory, 'NotoSansCJKsc-Regular.otf');
    if (fallback.exists && !bundled.exists) await fallback.copy(bundled);
    let loaded = 0;
    let bytes = 0;
    for (const [index, font] of fonts.entries()) {
      if (signal.aborted) return;
      const destination = new File(
        fontExtension(font.name) === 'woff2' ? directory : fontsDirectory,
        `${index}.${fontExtension(font.name)}`,
      );
      if (!isFont(destination, font.size)) {
        const partial = new File(root, `${randomUUID()}.part`);
        let moved = false;
        try {
          if (destination.exists) destination.delete();
          if (font.url.startsWith('file://')) await new File(font.url).copy(partial);
          else
            await File.downloadFileAsync(font.url, partial, {
              headers: api.accessToken ? { 'X-Emby-Token': api.accessToken } : {},
              signal,
            });
          if (signal.aborted || !isFont(partial, font.size)) continue;
          await partial.move(destination);
          moved = true;
        } catch {
          /* An unavailable font must not interrupt video playback. */
        } finally {
          if (!moved && partial.exists) partial.delete();
        }
      }
      if (isFont(destination, font.size)) {
        if (fontExtension(font.name) === 'woff2') {
          const decoded = new File(fontsDirectory, `${index}.ttf`);
          if (!isFont(decoded)) {
            const partial = new File(root, `${randomUUID()}.part`);
            let moved = false;
            try {
              await decodeWoff2(destination.uri, partial.uri);
              if (signal.aborted || !isFont(partial)) continue;
              if (decoded.exists) decoded.delete();
              await partial.move(decoded);
              moved = true;
            } catch {
              continue;
            } finally {
              if (!moved && partial.exists) partial.delete();
            }
          }
          bytes += decoded.size;
        }
        loaded++;
        bytes += destination.size;
      }
      if (bytes >= 64 * 1024 * 1024) break;
    }
    return !signal.aborted && loaded ? fontsDirectory.uri : undefined;
  }

  return {
    prune,
    async clear() {
      generation++;
      lists.clear();
      for (const job of jobs.values()) job.controller.abort();
      await prune(true);
    },
    createSession(scope: Scope) {
      const owner = Symbol('subtitle-fonts');
      const sessionGeneration = generation;
      const held = new Set<string>();
      let disposed = false;
      const active = () => !disposed && sessionGeneration === generation;
      return {
        async prepare(request: Omit<Request, keyof Scope>) {
          if (!active()) return;
          root.create({ intermediates: true, idempotent: true });
          if (!initialized) {
            initialized = true;
            for (const file of root.list())
              if (file instanceof File && file.name.endsWith('.part')) file.delete();
          }
          const serverKey = await hash([scope.serverId, scope.userId]);
          const fallback =
            !request.localOnly && request.type === 'jellyfin'
              ? await fallbackFonts(serverKey, request.api)
              : [];
          if (!active()) return;
          const fonts = request.localOnly
            ? []
            : deriveSubtitleFonts(
                request.api,
                request.type,
                request.itemId,
                request.source,
                fallback,
              );
          if (request.customFont) fonts.unshift(request.customFont);
          if (!fonts.length) return;
          const key = await hash([serverKey, fonts.map((font) => font.revision)]);
          if (!active()) return;
          const owners = leases.get(key) ?? new Set<symbol>();
          owners.add(owner);
          leases.set(key, owners);
          held.add(key);
          let job = jobs.get(key);
          if (job?.controller.signal.aborted) {
            await job.promise.catch(() => {});
            job = jobs.get(key);
          }
          if (!active()) return;
          if (!job) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            const promise = download(
              new Directory(root, key),
              fonts,
              request.api,
              controller.signal,
            );
            job = { controller, promise };
            jobs.set(key, job);
            void promise
              .finally(() => {
                clearTimeout(timeout);
                if (jobs.get(key)?.promise === promise) jobs.delete(key);
                void prune().catch(() => {});
              })
              .catch(() => {});
          }
          const directory = await job.promise;
          return active() ? directory : undefined;
        },
        dispose() {
          disposed = true;
          for (const key of held) {
            const owners = leases.get(key);
            owners?.delete(owner);
            if (!owners?.size) {
              leases.delete(key);
              jobs.get(key)?.controller.abort();
            }
          }
          held.clear();
          void prune().catch(() => {});
        },
      };
    },
  };
}

const shared = createSubtitleFontCacheStore();
export const createSubtitleFontSession = (scope: Scope) => shared.createSession(scope);
export const clearSubtitleFontCache = () => shared.clear();
