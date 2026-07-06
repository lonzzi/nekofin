import { Stack } from 'expo-router';

import HeaderBackButton from './HeaderBackButton';

const DEFAULT_SCREEN_OPTIONS = {
  fullScreenGestureEnabled: false,
  gestureEnabled: true,
  headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => (
    <HeaderBackButton canGoBack={canGoBack} />
  ),
  headerTitle: '',
  headerTransparent: true,
  headerBlurEffect: 'none',
} as const;

const ROUTE_NAMES = ['series/[id]', 'movie/[id]', 'episode/index'] as const;

export function GroupedStackRoutes() {
  return ROUTE_NAMES.map((name) => (
    <Stack.Screen key={name} name={name} options={DEFAULT_SCREEN_OPTIONS} />
  ));
}
