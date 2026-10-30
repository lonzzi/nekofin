import type { ImageSourcePropType } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export const ANDROID_SETTINGS_ICONS = {
  'chevron.backward': require('../../assets/drawables/chevron_left.xml'),
  'exclamationmark.triangle': require('../../assets/drawables/warning.xml'),
  magnifyingglass: require('../../assets/drawables/search.xml'),
  tv: require('../../assets/drawables/tv.xml'),
  sparkles: require('../../assets/drawables/sparkles.xml'),
  'text.bubble': require('../../assets/drawables/chat_bubble.xml'),
  'speaker.wave.2.fill': require('../../assets/drawables/volume_up.xml'),
} satisfies Partial<Record<SFSymbol, ImageSourcePropType>>;

export type SettingsSymbolName = keyof typeof ANDROID_SETTINGS_ICONS;
