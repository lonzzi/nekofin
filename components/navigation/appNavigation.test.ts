import { StackRouter } from 'expo-router/build/react-navigation/routers/StackRouter';
import { TabRouter } from 'expo-router/build/react-navigation/routers/TabRouter';
import type { NavigationAction, NavigationState } from 'expo-router/react-navigation';
import { describe, expect, it, vi } from 'vitest';

import { navigateToAppDestination } from './appNavigation';
import { navigationDestinations } from './navigationDestinations';

function rootWithTabs(child?: NavigationState, covered = false) {
  const tabs = TabRouter({ initialRouteName: '(home)' }).getInitialState({
    routeNames: ['(home)', '(settings)'],
    routeParamList: {},
    routeGetIdList: {},
  });
  const stackRouter = StackRouter({ initialRouteName: '(tabs)' });
  const options = {
    routeNames: ['(tabs)', 'player'],
    routeParamList: {},
    routeGetIdList: {},
  };
  let app = stackRouter.getInitialState(options);
  if (covered) {
    const next = stackRouter.getStateForAction(
      app,
      { type: 'PUSH', payload: { name: 'player' } },
      options,
    );
    if (!next || next.stale !== false) throw new Error('Unhandled player PUSH');
    app = next;
  }
  return {
    ...app,
    routes: app.routes.map((route) =>
      route.name === '(tabs)'
        ? {
            ...route,
            state: {
              ...tabs,
              routes: tabs.routes.map((tab) =>
                tab.name === '(home)' ? { ...tab, state: child } : tab,
              ),
            },
          }
        : route,
    ),
  };
}

describe('shared app root navigation', () => {
  it.each(navigationDestinations.map((entry) => entry.key))(
    'returns to the original %s root before selecting its native tab',
    (destination) => {
      const rootName = destination === 'search' ? '(root)' : 'index';
      const childRouter = StackRouter({ initialRouteName: rootName });
      const childOptions = {
        routeNames: [rootName, 'detail'],
        routeParamList: {},
        routeGetIdList: {},
      };
      const initialChild = childRouter.getInitialState(childOptions);
      let child = initialChild;
      // Include an old duplicate root to verify that switching also repairs
      // history accumulated by the former nested NAVIGATE action.
      for (const name of ['detail', rootName, 'detail']) {
        const next = childRouter.getStateForAction(
          child,
          { type: 'PUSH', payload: { name } },
          childOptions,
        );
        if (!next || next.stale !== false) throw new Error('Unhandled PUSH');
        child = next;
      }
      const other = destination === 'home' ? 'favorites' : 'home';
      const tabRouter = TabRouter({ initialRouteName: `(${other})` });
      const tabOptions = {
        routeNames: [`(${other})`, `(${destination})`],
        routeParamList: {},
        routeGetIdList: {},
      };
      let tabs = tabRouter.getInitialState(tabOptions);
      const appRouter = StackRouter({ initialRouteName: '(tabs)' });
      const app = appRouter.getInitialState({
        routeNames: ['(tabs)'],
        routeParamList: {},
        routeGetIdList: {},
      });
      const navigation = {
        getRootState: () => ({
          ...app,
          key: 'runtime-root-stack',
          routeNames: ['__root'],
          routes: [
            {
              name: '__root',
              key: 'runtime-root',
              state: {
                ...app,
                routes: [
                  {
                    ...app.routes[0],
                    state: {
                      ...tabs,
                      routes: tabs.routes.map((route) =>
                        route.name === `(${destination})` ? { ...route, state: child } : route,
                      ),
                    },
                  },
                ],
              },
            },
          ],
        }),
        dispatch: vi.fn((action: NavigationAction) => {
          if (action.target === child.key && action.type === 'POP_TO_TOP') {
            const next = childRouter.getStateForAction(child, { type: 'POP_TO_TOP' }, childOptions);
            if (!next || next.stale !== false) throw new Error('Unhandled POP_TO_TOP');
            child = next;
          } else {
            throw new Error(`Unexpected action: ${action.type}`);
          }
        }),
      };
      const router = {
        navigate: vi.fn(() => {
          // Expo's public path navigation selects the tab and forwards its root
          // screen to the nested stack. Exercise both routers to catch duplicate
          // roots and retention of detail screens across repeated visits.
          const nextTabs = tabRouter.getStateForAction(
            tabs,
            {
              type: 'NAVIGATE',
              payload: { name: `(${destination})`, params: { screen: rootName } },
            },
            tabOptions,
          );
          const nextChild = childRouter.getStateForAction(
            child,
            { type: 'NAVIGATE', payload: { name: rootName } },
            childOptions,
          );
          if (!nextTabs || nextTabs.stale !== false || !nextChild || nextChild.stale !== false) {
            throw new Error('Unhandled root NAVIGATE');
          }
          tabs = nextTabs;
          child = nextChild;
        }),
        dismissTo: vi.fn(),
      };
      navigateToAppDestination(router, destination, navigation);
      expect(child.routes).toEqual(initialChild.routes);
      expect(tabs.routes[tabs.index].name).toBe(`(${destination})`);
      expect(navigation.dispatch).toHaveBeenLastCalledWith({
        type: 'POP_TO_TOP',
        target: initialChild.key,
      });
      expect(router.navigate).toHaveBeenCalledExactlyOnceWith(
        navigationDestinations.find((entry) => entry.key === destination)!.href,
      );
      expect(router.dismissTo).not.toHaveBeenCalled();

      navigation.dispatch.mockClear();
      navigateToAppDestination(router, destination, navigation);
      expect(navigation.dispatch).not.toHaveBeenCalled();
      expect(child.routes).toEqual(initialChild.routes);

      for (let visit = 0; visit < 3; visit++) {
        const next = childRouter.getStateForAction(
          child,
          { type: 'PUSH', payload: { name: 'detail' } },
          childOptions,
        );
        if (!next || next.stale !== false) throw new Error('Unhandled detail PUSH');
        child = next;
        navigateToAppDestination(router, destination, navigation);
        expect(child.routes).toEqual(initialChild.routes);
      }
    },
  );

  it('initializes a lazy tab through the public path router', () => {
    const state = rootWithTabs();
    const navigation = { getRootState: () => state, dispatch: vi.fn() };
    const router = { navigate: vi.fn(), dismissTo: vi.fn() };
    navigateToAppDestination(router, 'settings', navigation);
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith('/(tabs)/(settings)');
    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('reads each rapid press from current navigation state instead of stale React segments', () => {
    const state = rootWithTabs();
    const navigation = {
      getRootState: vi.fn(() => state),
      dispatch: vi.fn(),
    };
    // Deliberately keep state unchanged until the queued path actions commit.
    // A second press must still navigate home, even though the snapshot says
    // home is already selected.
    const router = { navigate: vi.fn(), dismissTo: vi.fn() };
    navigateToAppDestination(router, 'settings', navigation);
    navigateToAppDestination(router, 'home', navigation);
    expect(router.navigate.mock.calls).toEqual([['/(tabs)/(settings)'], ['/(tabs)/(home)']]);
    expect(navigation.getRootState).toHaveBeenCalledTimes(2);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('creates the missing root when a deep link initialized a tab directly on a detail', () => {
    const stack = StackRouter({ initialRouteName: 'detail' });
    const options = {
      routeNames: ['index', 'detail'],
      routeParamList: {},
      routeGetIdList: {},
    };
    let child = stack.getInitialState(options);
    const navigation = {
      getRootState: () => rootWithTabs(child),
      dispatch: vi.fn((action: NavigationAction) => {
        expect(action).toEqual({
          type: 'POP_TO',
          target: child.key,
          payload: { name: 'index' },
        });
        const next = stack.getStateForAction(
          child,
          { type: 'POP_TO', payload: { name: 'index' } },
          options,
        );
        if (!next || next.stale !== false) throw new Error('Unhandled deep-link POP_TO');
        child = next;
      }),
    };
    const router = { navigate: vi.fn(), dismissTo: vi.fn() };
    navigateToAppDestination(router, 'home', navigation);
    expect(child.routes.map((route) => route.name)).toEqual(['index']);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('uses the router for a fullscreen exit so native removal guards still receive the action', () => {
    const state = rootWithTabs(undefined, true);
    const navigation = { getRootState: () => state, dispatch: vi.fn() };
    const router = { navigate: vi.fn(), dismissTo: vi.fn() };
    navigateToAppDestination(router, 'settings', navigation);
    expect(router.dismissTo).toHaveBeenCalledExactlyOnceWith('/(tabs)/(settings)');
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('returns from a cold fullscreen deep link that has no tab history', () => {
    const state = StackRouter({ initialRouteName: 'player' }).getInitialState({
      routeNames: ['player', '(tabs)'],
      routeParamList: {},
      routeGetIdList: {},
    });
    const navigation = { getRootState: () => state, dispatch: vi.fn() };
    const router = { navigate: vi.fn(), dismissTo: vi.fn() };
    navigateToAppDestination(router, 'servers', navigation);
    expect(router.dismissTo).toHaveBeenCalledExactlyOnceWith('/(tabs)/(servers)');
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('ignores unknown destination events', () => {
    const navigation = { getRootState: vi.fn(rootWithTabs), dispatch: vi.fn() };
    const router = { navigate: vi.fn(), dismissTo: vi.fn() };
    navigateToAppDestination(router, 'unknown', navigation);
    expect(navigation.getRootState).not.toHaveBeenCalled();
    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
