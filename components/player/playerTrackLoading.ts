import type { ExpoMpvViewRef } from 'expo-mpv';

export type ExternalPlayerTrack = {
  index: number;
  name: string;
  language?: string;
  url: string;
};

/** Retain failures only for tracks whose caller offers an explicit retry. */
export function createExternalTrackRequestCache() {
  const requests = new Map<string, Promise<number | undefined>>();
  const failures = new Set<string>();
  return {
    load(
      key: string,
      start: () => Promise<number | undefined>,
      { cacheFailures = true }: { cacheFailures?: boolean } = {},
    ) {
      const existing = requests.get(key);
      if (existing) return existing;
      const request = Promise.resolve().then(start);
      requests.set(key, request);
      void request.catch(() => {
        if (requests.get(key) !== request) return;
        if (cacheFailures) failures.add(key);
        else requests.delete(key);
      });
      return request;
    },
    retry(key: string) {
      if (!failures.delete(key)) return;
      requests.delete(key);
    },
  };
}

export const externalTrackRequestKey = (type: 'sub' | 'audio', track: ExternalPlayerTrack) =>
  `${type}:${track.index}:${track.url}`;

export async function selectPlayerSubtitleTrack(
  player: Pick<ExpoMpvViewRef, 'setSubtitleTrack' | 'setPropertyString' | 'getCurrentTrackIds'>,
  trackId: number,
  isActive: () => boolean,
) {
  if (!isActive()) return;
  if (trackId === -1) await player.setPropertyString('sid', 'no');
  else await player.setSubtitleTrack(trackId);
  if (!isActive()) return;
  const ids = await player.getCurrentTrackIds();
  if (!isActive()) return;
  if (trackId === -1 ? ids.sid > 0 : ids.sid !== trackId)
    throw new Error('Subtitle selection was not confirmed');
  return ids;
}

/** Publish embedded tracks first, then each loaded external track without waiting for the rest. */
export async function loadExternalTracksProgressively(
  requests: (() => Promise<unknown>)[],
  refresh: () => Promise<void>,
  isActive: () => boolean,
): Promise<{ failed: boolean } | undefined> {
  if (!isActive()) return;
  await refresh();
  let failed = false;
  for (const request of requests) {
    if (!isActive()) return;
    try {
      await request();
    } catch {
      failed = true;
    }
    if (!isActive()) return;
    await refresh();
  }
  return isActive() ? { failed } : undefined;
}

export function isExternalTrackCommandError(message: string) {
  return /^Command '(?:sub-add|audio-add|sub-remove|audio-remove|sub-reload)' failed:/.test(
    message,
  );
}

// Keep each native add and ID discovery together so concurrent requests cannot
// claim the same track ID.
const nativeTrackQueues = new WeakMap<object, Promise<unknown>>();

export function loadExternalPlayerTrack(
  player: Pick<ExpoMpvViewRef, 'getTrackList' | 'addSubtitle' | 'addAudio'>,
  type: 'sub' | 'audio',
  track: ExternalPlayerTrack,
  isActive: () => boolean,
): Promise<number | undefined> {
  const previous = nativeTrackQueues.get(player) ?? Promise.resolve();
  const request = previous
    .catch(() => {})
    .then(() => loadExternalPlayerTrackNow(player, type, track, isActive));
  nativeTrackQueues.set(player, request);
  void request
    .finally(() => {
      if (nativeTrackQueues.get(player) === request) nativeTrackQueues.delete(player);
    })
    .catch(() => {});
  return request;
}

async function loadExternalPlayerTrackNow(
  player: Pick<ExpoMpvViewRef, 'getTrackList' | 'addSubtitle' | 'addAudio'>,
  type: 'sub' | 'audio',
  track: ExternalPlayerTrack,
  isActive: () => boolean,
): Promise<number | undefined> {
  // Native add commands can resolve before the new track is available.
  if (!isActive()) return;
  const before = await player.getTrackList();
  if (!isActive()) return;
  const knownIds = new Set(before.filter((entry) => entry.type === type).map((entry) => entry.id));
  if (type === 'sub') await player.addSubtitle(track.url, 'auto', track.name, track.language);
  else await player.addAudio(track.url, 'auto', track.name, track.language);

  for (let attempt = 0; attempt < 40 && isActive(); attempt++) {
    const list = await player.getTrackList();
    if (!isActive()) return;
    const added = list.find((entry) => entry.type === type && !knownIds.has(entry.id));
    if (added) return added.id;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (isActive()) throw new Error('External track did not become available');
}
