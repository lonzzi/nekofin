import { t as tr } from '@/lib/i18n';

import {
  loadDanmakuSelections,
  type DanmakuCommentsData,
  type DanmakuEpisodeSelection,
} from './danmaku';
import { danmakuSourcesKey } from './danmakuSources';

export const danmakuEpisodeCacheKey = (entry: DanmakuEpisodeSelection) =>
  danmakuSourcesKey([entry.source]) + ':' + entry.episode.episodeId;

type Job = {
  key: string;
  entry: DanmakuEpisodeSelection;
  controller: AbortController;
  resolve: (data: DanmakuCommentsData) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
};

function throwIfAborted(signal: AbortSignal) {
  if (!signal.aborted) return;
  const error = new Error(tr('danmaku.requestCanceled'));
  error.name = 'AbortError';
  throw error;
}

/** Read visible episode previews one at a time, reusing the last three for immediate playback. */
export function createDanmakuEpisodeLoader(
  fetchEpisode = (entry: DanmakuEpisodeSelection, signal: AbortSignal) =>
    loadDanmakuSelections([entry], signal),
) {
  const cache = new Map<string, DanmakuCommentsData>();
  const queue: Job[] = [];
  const pending = new Map<string, { job: Job; promise: Promise<DanmakuCommentsData> }>();
  let active: Job | undefined;

  const pump = async () => {
    if (active) return;
    const job = queue.shift();
    if (!job) return;
    active = job;
    try {
      throwIfAborted(job.controller.signal);
      const data = await fetchEpisode(job.entry, job.controller.signal);
      throwIfAborted(job.controller.signal);
      if (!data.tracks?.length || data.failedSources?.length)
        throw new Error(tr('danmaku.countUnavailable'));
      cache.set(job.key, data);
      while (cache.size > 3) cache.delete(cache.keys().next().value!);
      job.resolve(data);
    } catch (error) {
      job.reject(error);
    } finally {
      job.cleanup();
      if (pending.get(job.key)?.job === job) pending.delete(job.key);
      active = undefined;
      void pump();
    }
  };

  return {
    load(entry: DanmakuEpisodeSelection, signal: AbortSignal, forPlayback = false) {
      throwIfAborted(signal);
      const key = danmakuEpisodeCacheKey(entry);
      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached);
      const existing = pending.get(key);
      if (existing && !existing.job.controller.signal.aborted) {
        if (forPlayback && existing.job !== active) {
          queue.splice(queue.indexOf(existing.job), 1);
          queue.unshift(existing.job);
          active?.controller.abort();
        }
        return existing.promise;
      }

      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      let job!: Job;
      const promise = new Promise<DanmakuCommentsData>((resolve, reject) => {
        job = {
          key,
          entry,
          controller,
          resolve,
          reject,
          cleanup: () => signal.removeEventListener('abort', abort),
        };
      });
      pending.set(key, { job, promise });
      if (forPlayback) {
        queue.unshift(job);
        active?.controller.abort();
      } else queue.push(job);
      void pump();
      return promise;
    },
  };
}
