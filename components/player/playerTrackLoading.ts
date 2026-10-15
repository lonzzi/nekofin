import type { ExpoMpvViewRef } from 'expo-mpv';

export type ExternalPlayerTrack = {
  index: number;
  name: string;
  language?: string;
  url: string;
};

export function isExternalTrackCommandError(message: string) {
  return /^Command '(?:sub-add|audio-add|sub-remove|audio-remove|sub-reload)' failed:/.test(
    message,
  );
}

// Native addSubtitle/addAudio enqueue mpv commands. Their promises resolve before
// network loading finishes, so wait for the new native ID before refreshing menus.
export async function loadExternalPlayerTrack(
  player: Pick<ExpoMpvViewRef, 'getTrackList' | 'addSubtitle' | 'addAudio'>,
  type: 'sub' | 'audio',
  track: ExternalPlayerTrack,
  isActive: () => boolean,
): Promise<number | undefined> {
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
