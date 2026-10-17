import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

export const SUBTITLE_CACHE_PATH = 'nekofin/subtitle-cache/v1';
export const SUBTITLE_CACHE_MAX_BYTES = 128 * 1024 * 1024;
export const SUBTITLE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export type SubtitleTrack = { index: number; name: string; language?: string; url: string };
export type SubtitleCacheScope = {
  serverId: string;
  userId: string;
  itemId: string;
  mediaSourceId: string;
  sourceSize?: number | null;
};
type Entry = { key: string; extension: string; createdAt: number; lastUsed: number; size: number };
type Job = { promise: Promise<File>; controller: AbortController };

/** Shared by details and playback, with persistent files and no stored signed URLs. */
export function createSubtitleCacheStore({
  maxBytes = SUBTITLE_CACHE_MAX_BYTES,
  maxAge = SUBTITLE_CACHE_MAX_AGE_MS,
  maxEntries = 128,
} = {}) {
  const directory = new Directory(Paths.cache, SUBTITLE_CACHE_PATH);
  const entries = new Map<string, Entry>();
  const leases = new Map<string, Set<symbol>>();
  const jobs = new Map<string, Job>();
  const pendingRemoval = new Set<string>();
  let generation = 0;
  let initialization: Promise<void> | undefined;
  let running = 0;
  const waiting: (() => void)[] = [];
  const fileFor = (entry: Pick<Entry, 'key' | 'extension'>) =>
    new File(directory, `${entry.key}.${entry.extension}`);
  const metadataFor = (key: string) => new File(directory, `${key}.json`);
  const remove = (file: File) => {
    if (file.exists) file.delete();
  };
  const evict = (entry: Entry) => {
    remove(fileFor(entry));
    remove(metadataFor(entry.key));
    entries.delete(entry.key);
    pendingRemoval.delete(entry.key);
  };

  const initialize = () =>
    (initialization ??= (async () => {
      entries.clear();
      directory.create({ intermediates: true, idempotent: true });
      for (const file of directory.list()) {
        if (!(file instanceof File) || !file.name.endsWith('.json')) continue;
        try {
          const entry = JSON.parse(await file.text()) as Entry;
          if (
            !/^[a-f0-9]{64}$/.test(entry.key) ||
            !/^(ass|ssa|srt|vtt|sub|idx|sup|ttml)$/.test(entry.extension) ||
            !Number.isFinite(entry.createdAt) ||
            !Number.isFinite(entry.lastUsed) ||
            !Number.isFinite(entry.size) ||
            entry.size <= 0 ||
            file.name !== `${entry.key}.json` ||
            fileFor(entry).size !== entry.size
          )
            throw new Error('Invalid cache entry');
          entries.set(entry.key, entry);
        } catch {
          remove(file);
        }
      }
      // Remove incomplete downloads and orphaned files from a killed process.
      const kept = new Set([...entries.values()].map((entry) => fileFor(entry).uri));
      for (const file of directory.list()) {
        if (file instanceof File && !file.name.endsWith('.json') && !kept.has(file.uri))
          remove(file);
      }
    })().catch((error) => {
      initialization = undefined;
      throw error;
    }));

  async function prune(clear = false) {
    await initialize();
    let bytes = [...entries.values()].reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of [...entries.values()].sort((a, b) => a.lastUsed - b.lastUsed)) {
      if (leases.get(entry.key)?.size) continue;
      if (
        clear ||
        pendingRemoval.has(entry.key) ||
        Date.now() - entry.createdAt >= maxAge ||
        bytes > maxBytes ||
        entries.size > maxEntries
      ) {
        bytes -= entry.size;
        evict(entry);
      }
    }
  }

  async function download(
    key: string,
    extension: string,
    url: string,
    controller: AbortController,
  ) {
    // Bound total network/disk work across details and players.
    if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
    else running++;
    const partial = new File(directory, `${key}-${randomUUID()}.part.${extension}`);
    const file = fileFor({ key, extension });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (controller.signal.aborted) throw new Error('Subtitle download cancelled');
      // Large typeset ASS files can need more than thirty seconds on remote routes.
      timeout = setTimeout(() => controller.abort(), 120_000);
      await File.downloadFileAsync(url, partial, { signal: controller.signal });
      if (controller.signal.aborted) throw new Error('Subtitle download cancelled');
      if (partial.size <= 0) throw new Error('Empty subtitle file');
      await partial.move(file, { overwrite: true });
      if (controller.signal.aborted) {
        remove(file);
        throw new Error('Subtitle download cancelled');
      }
      const entry = {
        key,
        extension,
        size: file.size,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      metadataFor(key).write(JSON.stringify(entry));
      entries.set(key, entry);
      await prune();
      return file;
    } catch (error) {
      remove(partial);
      throw error;
    } finally {
      clearTimeout(timeout);
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  }

  return {
    prune,
    async clear() {
      generation++;
      for (const job of jobs.values()) job.controller.abort();
      for (const key of entries.keys()) pendingRemoval.add(key);
      await prune(true); // Keep files currently held by mpv.
    },
    createSession(scope: SubtitleCacheScope) {
      const owner = Symbol('subtitle-consumer');
      const sessionGeneration = generation;
      const held = new Set<string>();
      let disposed = false;
      return {
        async prepare(track: SubtitleTrack, isActive: () => boolean) {
          if (disposed || sessionGeneration !== generation || !isActive()) return;
          const extension =
            new URL(track.url).pathname
              .match(/\.(ass|ssa|srt|vtt|sub|idx|sup|ttml)$/i)?.[1]
              ?.toLowerCase() ?? 'sub';
          // Independent of route/token, scoped to account, source and stream.
          const key = await digestStringAsync(
            CryptoDigestAlgorithm.SHA256,
            JSON.stringify([
              scope.serverId,
              scope.userId,
              scope.itemId,
              scope.mediaSourceId,
              scope.sourceSize ?? null,
              track.index,
              track.name,
              track.language ?? null,
              extension,
            ]),
          );
          await initialize();
          if (disposed || sessionGeneration !== generation || !isActive()) return;
          const owners = leases.get(key) ?? new Set<symbol>();
          const alreadyLeased = owners.size > 0;
          owners.add(owner);
          leases.set(key, owners);
          held.add(key);
          try {
            let entry = entries.get(key);
            if (
              entry &&
              (fileFor(entry).size !== entry.size ||
                ((pendingRemoval.has(key) || Date.now() - entry.createdAt >= maxAge) &&
                  !alreadyLeased))
            ) {
              evict(entry);
              entry = undefined;
            }
            let file: File;
            if (entry) {
              entry.lastUsed = Date.now();
              metadataFor(key).write(JSON.stringify(entry));
              file = fileFor(entry);
            } else {
              let job = jobs.get(key);
              if (!job || job.controller.signal.aborted) {
                // Finish cancellation cleanup before reusing a destination.
                if (job) await job.promise.catch(() => {});
                if (disposed || sessionGeneration !== generation || !isActive()) return;
                job = jobs.get(key);
                if (!job) {
                  const controller = new AbortController();
                  const promise = download(key, extension, track.url, controller);
                  job = { controller, promise };
                  jobs.set(key, job);
                  void promise
                    .finally(() => {
                      if (jobs.get(key)?.promise === promise) jobs.delete(key);
                    })
                    .catch(() => {});
                }
              }
              file = await job.promise;
            }
            if (!disposed && sessionGeneration === generation && isActive())
              return { ...track, url: file.uri };
          } catch (error) {
            if (!disposed && sessionGeneration === generation && isActive()) throw error;
          }
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

const sharedCache = createSubtitleCacheStore();
export const createExternalSubtitleCache = (scope: SubtitleCacheScope) =>
  sharedCache.createSession(scope);
export const clearSubtitleCache = () => sharedCache.clear();
export const pruneSubtitleCache = async () => {
  await sharedCache.prune();
  // Previous versions created per-playback files here; none are used by this cache.
  const legacy = new Directory(Paths.cache, 'player-subtitles');
  if (legacy.exists) legacy.delete();
};
