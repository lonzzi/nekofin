import { t as tr } from '@/lib/i18n';

import { navigationDestinations } from './navigationDestinations';

/** iPad sidebar presentation of the shared app destinations. */
const sidebarOrder = ['home', 'servers', 'favorites', 'search', 'settings'] as const;
export const tabletDestinations = sidebarOrder.map((key) => {
  const destination = navigationDestinations.find((entry) => entry.key === key)!;
  return {
    key: destination.key,
    get title() {
      return destination.title;
    },
    icon: destination.sf.default,
    href: destination.href,
    get section() {
      return tr(destination.key === 'settings' ? 'navigation.settings' : 'media.media');
    },
  };
});

export function tabletDestinationKey(segments: readonly string[]) {
  return navigationDestinations.find((entry) => segments.includes(entry.name))?.key ?? 'home';
}
