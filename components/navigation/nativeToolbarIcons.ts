import type { MediaServerType } from '@/services/media/types';
import type { ImageSourcePropType } from 'react-native';

import type { AndroidToolbarDrawable } from './nativeHeaderModel';

export type NativeToolbarIOSIcon =
  | 'checkmark'
  | 'checkmark.circle'
  | 'checkmark.circle.fill'
  | 'film'
  | 'heart'
  | 'heart.fill'
  | 'magnifyingglass'
  | 'person'
  | 'plus';

const ANDROID_TOOLBAR_ICONS = {
  add: require('../../assets/drawables/add.png'),
  checkmarkCircle: require('../../assets/drawables/checkmark_circle.png'),
  checkmarkCircleOutline: require('../../assets/drawables/checkmark_circle_outline.png'),
  film: require('../../assets/drawables/film.png'),
  heart: require('../../assets/drawables/heart.png'),
  heartOutline: require('../../assets/drawables/heart_outline.png'),
  person: require('../../assets/drawables/person.png'),
  save: require('../../assets/drawables/save.png'),
  search: require('../../assets/drawables/search.png'),
} as const satisfies Record<AndroidToolbarDrawable, ImageSourcePropType>;

export const DETAIL_MORE_MENU_ICONS = {
  more: process.env.EXPO_OS === 'ios' ? 'ellipsis' : require('../../assets/drawables/more.xml'),
  external:
    process.env.EXPO_OS === 'ios'
      ? 'arrow.up.right.square'
      : require('../../assets/drawables/open_external.xml'),
  share:
    process.env.EXPO_OS === 'ios'
      ? 'square.and.arrow.up'
      : require('../../assets/drawables/share.xml'),
} as const;

export function getServerMenuIcon(type: MediaServerType): ImageSourcePropType {
  if (process.env.EXPO_OS === 'ios') {
    return { uri: type === 'jellyfin' ? 'jellyfin-icon--color-on-light' : 'emby' };
  }
  // Android menu actions always tint their icon; keep the play triangle transparent.
  return type === 'jellyfin'
    ? require('../../assets/icons/jellyfin-icon--color-on-light.png')
    : require('../../assets/drawables/emby_template.xml');
}

export function getNativeToolbarIcon(
  androidDrawable: AndroidToolbarDrawable,
  iosIcon: NativeToolbarIOSIcon,
): ImageSourcePropType | NativeToolbarIOSIcon {
  return process.env.EXPO_OS === 'ios' ? iosIcon : ANDROID_TOOLBAR_ICONS[androidDrawable];
}
