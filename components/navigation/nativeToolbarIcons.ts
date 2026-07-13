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
  | 'plus';

const ANDROID_TOOLBAR_ICONS = {
  add: require('../../assets/drawables/add.png'),
  checkmarkCircle: require('../../assets/drawables/checkmark_circle.png'),
  checkmarkCircleOutline: require('../../assets/drawables/checkmark_circle_outline.png'),
  film: require('../../assets/drawables/film.png'),
  heart: require('../../assets/drawables/heart.png'),
  heartOutline: require('../../assets/drawables/heart_outline.png'),
  save: require('../../assets/drawables/save.png'),
  search: require('../../assets/drawables/search.png'),
} as const satisfies Record<AndroidToolbarDrawable, ImageSourcePropType>;

export function getNativeToolbarIcon(
  androidDrawable: AndroidToolbarDrawable,
  iosIcon: NativeToolbarIOSIcon,
): ImageSourcePropType | NativeToolbarIOSIcon {
  return process.env.EXPO_OS === 'ios' ? iosIcon : ANDROID_TOOLBAR_ICONS[androidDrawable];
}
