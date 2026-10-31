import type { ImperativeRouter } from 'expo-router';
import type {
  NavigationContainerRef,
  NavigationState,
  ParamListBase,
  PartialState,
} from 'expo-router/react-navigation';

import { navigationDestinations } from './navigationDestinations';

type NestedState = NavigationState | PartialState<NavigationState>;
type AppNavigation = Pick<NavigationContainerRef<ParamListBase>, 'getRootState' | 'dispatch'>;

function findAppTabs(state?: NestedState): NestedState | undefined {
  for (const route of state?.routes ?? []) {
    if (route.name === '(tabs)') return route.state;
    const tabs = findAppTabs(route.state);
    if (tabs) return tabs;
  }
}

function areAppTabsFocused(state?: NestedState): boolean {
  while (state) {
    const route = state.routes[state.index ?? 0];
    if (route?.name === '(tabs)') return true;
    state = route?.state;
  }
  return false;
}

/** Shared by phone/tablet navigation, account menus and links to app roots. */
export function navigateToAppDestination(
  router: Pick<ImperativeRouter, 'navigate' | 'dismissTo'>,
  key: string,
  navigation: AppNavigation,
) {
  const next = navigationDestinations.find((entry) => entry.key === key);
  if (!next) return;
  const state = navigation.getRootState();
  const tabs = findAppTabs(state);
  const target = tabs?.routes.find((route) => route.name === next.name);
  if (tabs?.key && target) {
    const stack = target.state;
    if (stack?.type === 'stack' && stack.key) {
      if (stack.routes[0]?.name === next.root) {
        if (stack.routes.length > 1) {
          navigation.dispatch({ type: 'POP_TO_TOP', target: stack.key });
        }
      } else {
        navigation.dispatch({ type: 'POP_TO', target: stack.key, payload: { name: next.root } });
      }
    }
    if (areAppTabsFocused(state)) {
      // Let Expo coordinate native tab selection and its request provenance.
      // The target stack is already at its original root, so the nested path
      // action cannot append a second root. Read state for every press rather
      // than using route segments from the preceding React render.
      router.navigate(next.href);
      return;
    }
  }
  // Deep links and fullscreen routes may have no tabs, or cover an existing
  // tab tree. Dismiss to the root through the router so removal guards still run.
  router.dismissTo(next.href);
}
