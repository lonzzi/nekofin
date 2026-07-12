import { Stack } from 'expo-router';

import { DETAIL_STACK_SCREEN_OPTIONS } from './navigation/nativeStackConfig';

const ROUTE_NAMES = ['series/[id]', 'movie/[id]', 'episode/index'] as const;

export function GroupedStackRoutes() {
  return ROUTE_NAMES.map((name) => (
    <Stack.Screen key={name} name={name} options={DETAIL_STACK_SCREEN_OPTIONS} />
  ));
}
