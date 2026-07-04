import { Stack } from 'expo-router';

const DEFAULT_SCREEN_OPTIONS = {
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
