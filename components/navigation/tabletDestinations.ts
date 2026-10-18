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
    title: '通用',
    icon: 'gearshape',
    href: '/(tabs)/(settings)',
    section: '设置',
  },
  {
    key: 'playback',
    title: '播放与画质',
    icon: 'play.rectangle',
    href: '/(tabs)/(settings)/playback',
    section: '设置',
  },
  {
    key: 'audio',
    title: '音频与字幕',
    icon: 'captions.bubble',
    href: '/(tabs)/(settings)/audio',
    section: '设置',
  },
  {
    key: 'danmaku',
    title: '弹幕',
    icon: 'text.bubble',
    href: '/(tabs)/(settings)/danmaku',
    section: '设置',
  },
  {
    key: 'cache',
    title: '存储管理',
    icon: 'internaldrive',
    href: '/(tabs)/(settings)/cache',
    section: '设置',
  },
  {
    key: 'about',
    title: '帮助与关于',
    icon: 'info.circle',
    href: '/(tabs)/(settings)/about',
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
  if (group === '(settings)') {
    const screen = segments[segments.indexOf(group) + 1];
    if (screen?.startsWith('danmaku')) return 'danmaku';
    if (screen === 'subtitle-fonts' || screen === 'subtitle-font-url') return 'audio';
    return tabletDestinations.some((item) => item.key === screen) ? screen : 'settings';
  }
  return group?.slice(1, -1) ?? 'home';
}
