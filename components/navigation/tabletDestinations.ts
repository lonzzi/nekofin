import type { Href } from 'expo-router';

export const tabletDestinations = [
  { key: 'home', title: '首页', icon: 'house', href: '/(tabs)/(home)', section: '媒体' },
  {
    key: 'servers',
    title: '服务器',
    icon: 'externaldrive',
    href: '/(tabs)/(servers)',
    section: '媒体',
  },
  { key: 'favorites', title: '收藏', icon: 'heart', href: '/(tabs)/(favorites)', section: '媒体' },
  {
    key: 'search',
    title: '搜索',
    icon: 'magnifyingglass',
    href: '/(tabs)/(search)',
    section: '媒体',
  },
  {
    key: 'settings',
    title: '设置',
    icon: 'gearshape',
    href: '/(tabs)/(settings)',
    section: '设置',
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
