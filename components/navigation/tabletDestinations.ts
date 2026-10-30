import { t as tr } from '@/lib/i18n';
import type { Href } from 'expo-router';

export const tabletDestinations = [
  {
    key: 'home',
    get title() {
      return tr('navigation.home');
    },
    icon: 'house',
    href: '/(tabs)/(home)',
    get section() {
      return tr('media.media');
    },
  },
  {
    key: 'servers',
    get title() {
      return tr('navigation.servers');
    },
    icon: 'externaldrive',
    href: '/(tabs)/(servers)',
    get section() {
      return tr('media.media');
    },
  },
  {
    key: 'favorites',
    get title() {
      return tr('navigation.favorites');
    },
    icon: 'heart',
    href: '/(tabs)/(favorites)',
    get section() {
      return tr('media.media');
    },
  },
  {
    key: 'search',
    get title() {
      return tr('search.title');
    },
    icon: 'magnifyingglass',
    href: '/(tabs)/(search)/(root)',
    get section() {
      return tr('media.media');
    },
  },
  {
    key: 'settings',
    get title() {
      return tr('navigation.settings');
    },
    icon: 'gearshape',
    href: '/(tabs)/(settings)',
    get section() {
      return tr('navigation.settings');
    },
  },
] as const satisfies readonly {
  key: string;
  title: string;
  icon: string;
  href: Href;
  section: string;
}[];

export function tabletDestinationKey(segments: readonly string[]) {
  const group = segments.find((segment) =>
    /^\((home|servers|favorites|search|settings)\)$/.test(segment),
  );
  return group?.slice(1, -1) ?? 'home';
}
