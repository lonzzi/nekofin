import { storage } from '@/lib/storage';
import {
  CUSTOM_SUBTITLE_FONTS_KEY,
  customSubtitleFontFile,
  parseCustomSubtitleFonts,
} from '@/services/customSubtitleFonts';
import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';

export function useCustomSubtitleFonts() {
  const [value] = useMMKVString(CUSTOM_SUBTITLE_FONTS_KEY, storage);
  return useMemo(() => {
    const settings = parseCustomSubtitleFonts(value);
    const font = settings.fonts.find((font) => font.id === settings.selection?.id);
    const file = font && customSubtitleFontFile(font);
    return {
      ...settings,
      selected:
        font && file?.exists
          ? { ...font, uri: file.uri, family: settings.selection!.family }
          : undefined,
    };
  }, [value]);
}
