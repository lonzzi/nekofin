import { t as tr } from '@/lib/i18n';

/** Shared ordering, labels and assets for native phone tabs and tablet navigation. */
export const navigationDestinations = [
  {
    key: 'home',
    role: 'tab',
    name: '(home)',
    get title() {
      return tr('navigation.home');
    },
    drawable: 'home',
    sf: { default: 'house', selected: 'house.fill' },
  },
  {
    key: 'servers',
    role: 'tab',
    name: '(servers)',
    get title() {
      return tr('navigation.servers');
    },
    drawable: 'storage',
    sf: { default: 'externaldrive', selected: 'externaldrive.fill' },
  },
  {
    key: 'favorites',
    role: 'tab',
    name: '(favorites)',
    get title() {
      return tr('navigation.favorites');
    },
    drawable: 'heart_outline',
    sf: { default: 'heart', selected: 'heart.fill' },
  },
  {
    key: 'settings',
    role: 'tab',
    name: '(settings)',
    get title() {
      return tr('navigation.settings');
    },
    drawable: 'settings',
    sf: { default: 'gearshape', selected: 'gearshape.fill' },
  },
  {
    key: 'search',
    role: 'search',
    name: '(search)',
    get title() {
      return tr('search.title');
    },
    drawable: 'search',
    sf: { default: 'magnifyingglass', selected: 'magnifyingglass' },
  },
] as const;
