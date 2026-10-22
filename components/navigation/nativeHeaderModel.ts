import { t as tr } from '@/lib/i18n';
import type { Href } from 'expo-router';

export type AndroidToolbarDrawable =
  | 'add'
  | 'checkmarkCircle'
  | 'checkmarkCircleOutline'
  | 'film'
  | 'heart'
  | 'heartOutline'
  | 'person'
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
  iosIcon: 'checkmark' | 'heart' | 'heart.fill';
  label: string;
};

export const NATIVE_HEADER_ACTIONS = {
  favorites: [
    {
      androidDrawable: 'film',
      iosIcon: 'film',
      key: 'library',
      get label() {
        return tr('media.libraries');
      },
      route: '/(tabs)/(servers)/library',
    },
    {
      androidDrawable: 'search',
      iosIcon: 'magnifyingglass',
      key: 'search',
      get label() {
        return tr('search.thisServer');
      },
      route: '/(tabs)/(servers)/server-search',
    },
  ],
  serverLibrary: [
    {
      androidDrawable: 'search',
      iosIcon: 'magnifyingglass',
      key: 'search',
      get label() {
        return tr('search.thisServer');
      },
      route: '/(tabs)/(servers)/server-search',
    },
    {
      androidDrawable: 'heart',
      iosIcon: 'heart',
      key: 'favorites',
      get label() {
        return tr('navigation.favorites');
      },
      route: '/(tabs)/(servers)/favorites',
    },
  ],
} as const satisfies Record<'favorites' | 'serverLibrary', readonly NavigationToolbarAction[]>;

export const DETAIL_TOOLBAR_STATES = {
  favorite: {
    off: {
      androidDrawable: 'heartOutline',
      iosIcon: 'heart',
      get label() {
        return tr('media.addToFavorites');
      },
    },
    on: {
      androidDrawable: 'heart',
      iosIcon: 'heart.fill',
      get label() {
        return tr('media.removeFavorite');
      },
    },
  },
  watched: {
    off: {
      androidDrawable: 'checkmarkCircleOutline',
      iosIcon: 'checkmark',
      get label() {
        return tr('media.markAsWatched');
      },
    },
    on: {
      androidDrawable: 'checkmarkCircle',
      iosIcon: 'checkmark',
      get label() {
        return tr('media.markAsUnwatched');
      },
    },
  },
} as const satisfies Record<
  'favorite' | 'watched',
  Record<'off' | 'on', DetailToolbarPresentation>
>;

export const ADD_SERVER_TOOLBAR_ACTION = {
  androidDrawable: 'add',
  iosIcon: 'plus',
  get label() {
    return tr('server.addMediaAccount');
  },
} as const;

export const ADD_SERVER_MENU_ACTIONS = [
  { key: 'jellyfin', label: 'Jellyfin' },
  { key: 'emby', label: 'Emby' },
] as const;

export function getAddServerSavePresentation(isSaving: boolean) {
  return {
    accessibilityLabel: isSaving ? tr('server.savingServer') : tr('server.saveServer'),
    disabled: isSaving,
    label: isSaving ? tr('common.saving') : tr('common.save'),
  } as const;
}
