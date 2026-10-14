import type { ImageSourcePropType } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export const ANDROID_SETTINGS_ICONS = {
  'chevron.backward': require('../../assets/drawables/chevron_left.png'),
  'exclamationmark.triangle': require('../../assets/drawables/warning.png'),
  magnifyingglass: require('../../assets/drawables/search.png'),
  tv: require('../../assets/drawables/tv.png'),
  sparkles: require('../../assets/drawables/sparkles.png'),
  'text.bubble': require('../../assets/drawables/chat_bubble.png'),
  'speaker.wave.2.fill': require('../../assets/drawables/volume_up.png'),
} satisfies Partial<Record<SFSymbol, ImageSourcePropType>>;

export type SettingsSymbolName = keyof typeof ANDROID_SETTINGS_ICONS;
