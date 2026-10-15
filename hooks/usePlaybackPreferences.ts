import { storage } from '@/lib/storage';
import type { PlaybackPreferences } from '@/services/media/playbackSelection';
import { useMemo } from 'react';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';

export function readPlaybackPreferences(): PlaybackPreferences {
  return {
    audioLanguage: storage.getString('playback.audioLanguage') ?? 'auto',
    subtitleLanguage: storage.getString('playback.subtitleLanguage') ?? 'auto',
    subtitlesEnabled: storage.getBoolean('playback.subtitlesEnabled') !== false,
  };
}

export function usePlaybackPreferences(): PlaybackPreferences {
  const [audioLanguage = 'auto'] = useMMKVString('playback.audioLanguage', storage);
  const [subtitleLanguage = 'auto'] = useMMKVString('playback.subtitleLanguage', storage);
  const [subtitlesEnabled = true] = useMMKVBoolean('playback.subtitlesEnabled', storage);
  return useMemo(
    () => ({ audioLanguage, subtitleLanguage, subtitlesEnabled }),
    [audioLanguage, subtitleLanguage, subtitlesEnabled],
  );
}
