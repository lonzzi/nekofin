/** Shared ordering, labels and assets for native phone tabs and tablet navigation. */
export const navigationDestinations = [
  {
    key: 'home',
    role: 'tab',
    name: '(home)',
    title: '首页',
    drawable: 'home',
    sf: { default: 'house', selected: 'house.fill' },
  },
  {
    key: 'servers',
    role: 'tab',
    name: '(servers)',
    title: '服务器',
    drawable: 'storage',
    sf: { default: 'externaldrive', selected: 'externaldrive.fill' },
  },
  {
    key: 'favorites',
    role: 'tab',
    name: '(favorites)',
    title: '收藏',
    drawable: 'heart_outline',
    sf: { default: 'heart', selected: 'heart.fill' },
  },
  {
    key: 'settings',
    role: 'tab',
    name: '(settings)',
    title: '设置',
    drawable: 'settings',
    sf: { default: 'gearshape', selected: 'gearshape.fill' },
  },
  {
    key: 'search',
    role: 'search',
    name: '(search)',
    title: '搜索',
    drawable: 'search',
    sf: { default: 'magnifyingglass', selected: 'magnifyingglass' },
  },
] as const;
