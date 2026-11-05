import { storage } from '@/lib/storage';
import type { PlaybackPreferences } from '@/services/media/playbackSelection';
import {
  parseSubtitlePreference,
  subtitlePreferenceForIndex,
  subtitlePreferenceKey,
  type SubtitlePreferenceScope,
} from '@/services/media/subtitlePreference';
import type { MediaSource } from '@/services/media/types';
import { useMemo } from 'react';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';

export function readPlaybackPreferences(scope?: SubtitlePreferenceScope): PlaybackPreferences {
  const key = scope && subtitlePreferenceKey(scope);
  return {
    audioLanguage: storage.getString('playback.audioLanguage') ?? 'auto',
    subtitleLanguage: storage.getString('playback.subtitleLanguage') ?? 'auto',
    subtitlesEnabled: storage.getBoolean('playback.subtitlesEnabled') !== false,
    subtitleChoice: key ? parseSubtitlePreference(storage.getString(key)) : undefined,
  };
}

export function rememberSubtitlePreference(
  scope: SubtitlePreferenceScope,
  source: MediaSource,
  index: number,
) {
  const key = subtitlePreferenceKey(scope);
  const choice = subtitlePreferenceForIndex(source, index);
  if (key && choice) storage.set(key, JSON.stringify(choice));
}

export function usePlaybackPreferences(scope?: SubtitlePreferenceScope): PlaybackPreferences {
  const [audioLanguage = 'auto'] = useMMKVString('playback.audioLanguage', storage);
  const [subtitleLanguage = 'auto'] = useMMKVString('playback.subtitleLanguage', storage);
  const [subtitlesEnabled = true] = useMMKVBoolean('playback.subtitlesEnabled', storage);
  const key = scope && subtitlePreferenceKey(scope);
  const [choice] = useMMKVString(key ?? 'playback.subtitleChoice.unscoped', storage);
  return useMemo(
    () => ({
      audioLanguage,
      subtitleLanguage,
      subtitlesEnabled,
      subtitleChoice: key ? parseSubtitlePreference(choice) : undefined,
    }),
    [audioLanguage, subtitleLanguage, subtitlesEnabled, choice, key],
  );
}
