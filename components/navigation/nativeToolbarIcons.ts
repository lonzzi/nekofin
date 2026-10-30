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
  add: require('../../assets/drawables/add.xml'),
  checkmarkCircle: require('../../assets/drawables/checkmark_circle.xml'),
  checkmarkCircleOutline: require('../../assets/drawables/checkmark_circle_outline.xml'),
  film: require('../../assets/drawables/film.xml'),
  heart: require('../../assets/drawables/heart.xml'),
  heartOutline: require('../../assets/drawables/heart_outline.xml'),
  person: require('../../assets/drawables/person.xml'),
  save: require('../../assets/drawables/save.xml'),
  search: require('../../assets/drawables/search.xml'),
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
  return SERVER_MENU_ICONS[type];
}

const SERVER_MENU_ICONS: Record<MediaServerType, ImageSourcePropType> =
  process.env.EXPO_OS === 'ios'
    ? {
        jellyfin: { uri: 'jellyfin-icon--color-on-light' },
        emby: { uri: 'emby' },
      }
    : {
        jellyfin: require('../../assets/icons/jellyfin-icon--color-on-light.png'),
        emby: require('../../assets/drawables/emby.xml'),
      };

export function getNativeToolbarIcon(
  androidDrawable: AndroidToolbarDrawable,
  iosIcon: NativeToolbarIOSIcon,
): ImageSourcePropType | NativeToolbarIOSIcon {
  return process.env.EXPO_OS === 'ios' ? iosIcon : ANDROID_TOOLBAR_ICONS[androidDrawable];
}
