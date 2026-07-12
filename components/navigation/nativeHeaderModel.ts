import type { Href } from 'expo-router';

export type AndroidToolbarDrawable =
  | 'add'
  | 'checkmarkCircle'
  | 'checkmarkCircleOutline'
  | 'film'
  | 'heart'
  | 'heartOutline'
  | 'save'
  | 'search';

type NavigationToolbarAction = {
  androidDrawable: AndroidToolbarDrawable;
  iosIcon: 'film' | 'heart' | 'magnifyingglass';
  key: 'favorites' | 'library' | 'search';
  label: string;
  route: Href;
};

type DetailToolbarPresentation = {
  androidDrawable: AndroidToolbarDrawable;
  iosIcon: 'checkmark.circle' | 'checkmark.circle.fill' | 'heart' | 'heart.fill';
  label: string;
};

export const NATIVE_HEADER_ACTIONS = {
  favorites: [
    {
      androidDrawable: 'film',
      iosIcon: 'film',
      key: 'library',
      label: '媒体库',
      route: '/(tabs)/(servers)/library',
    },
    {
      androidDrawable: 'search',
      iosIcon: 'magnifyingglass',
      key: 'search',
      label: '服务器内搜索',
      route: '/(tabs)/(servers)/server-search',
    },
  ],
  serverLibrary: [
    {
      androidDrawable: 'search',
      iosIcon: 'magnifyingglass',
      key: 'search',
      label: '服务器内搜索',
      route: '/(tabs)/(servers)/server-search',
    },
    {
      androidDrawable: 'heart',
      iosIcon: 'heart',
      key: 'favorites',
      label: '收藏',
      route: '/(tabs)/(servers)/favorites',
    },
  ],
} as const satisfies Record<'favorites' | 'serverLibrary', readonly NavigationToolbarAction[]>;

export const DETAIL_TOOLBAR_STATES = {
  favorite: {
    off: {
      androidDrawable: 'heartOutline',
      iosIcon: 'heart',
      label: '添加收藏',
    },
    on: {
      androidDrawable: 'heart',
      iosIcon: 'heart.fill',
      label: '取消收藏',
    },
  },
  watched: {
    off: {
      androidDrawable: 'checkmarkCircleOutline',
      iosIcon: 'checkmark.circle',
      label: '标记为已观看',
    },
    on: {
      androidDrawable: 'checkmarkCircle',
      iosIcon: 'checkmark.circle.fill',
      label: '标记为未观看',
    },
  },
} as const satisfies Record<
  'favorite' | 'watched',
  Record<'off' | 'on', DetailToolbarPresentation>
>;

export const ADD_SERVER_TOOLBAR_ACTION = {
  androidDrawable: 'add',
  iosIcon: 'plus',
  label: '添加媒体账号',
} as const;

export const ADD_SERVER_MENU_ACTIONS = [
  { key: 'jellyfin', label: 'Jellyfin' },
  { key: 'emby', label: 'Emby' },
] as const;

export function getAddServerSavePresentation(isSaving: boolean) {
  return {
    accessibilityLabel: isSaving ? '正在保存服务器' : '保存服务器',
    disabled: isSaving,
    label: isSaving ? '保存中…' : '保存',
  } as const;
}
