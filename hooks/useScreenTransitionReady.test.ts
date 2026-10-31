import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useScreenTransitionReady } from './useScreenTransitionReady';

const state = vi.hoisted(() => ({
  focused: true,
  index: 1,
  finished: undefined as boolean | undefined,
  deps: undefined as readonly unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined,
  listener: undefined as ((event: { data: { closing: boolean } }) => void) | undefined,
  navigation: {
    addListener: vi.fn(),
    getState: vi.fn(),
  },
  setFinished: vi.fn(),
}));
vi.mock('expo-router', () => ({ useNavigation: () => state.navigation }));
vi.mock('expo-router/react-navigation', () => ({ useIsFocused: () => state.focused }));
vi.mock('react', () => ({
  useState: (initial: boolean) => [(state.finished ??= initial), state.setFinished],
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    if (state.deps && deps.every((value, index) => Object.is(value, state.deps![index]))) return;
    state.cleanup?.();
    state.deps = deps;
    state.cleanup = effect();
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.focused = true;
  state.index = 1;
  state.finished = undefined;
  state.deps = undefined;
  state.cleanup = undefined;
  state.listener = undefined;
  state.navigation.getState.mockImplementation(() => ({ index: state.index }));
  state.navigation.addListener.mockImplementation((_type, listener) => {
    state.listener = listener;
    return () => {
      state.listener = undefined;
    };
  });
  state.setFinished.mockImplementation((value: boolean) => {
    state.finished = value;
  });
});
afterEach(() => {
  state.cleanup?.();
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('waits for the shared native opening event and ignores closing transitions', () => {
  expect(useScreenTransitionReady()).toBe(false);
  vi.advanceTimersByTime(300);
  expect(state.finished).toBe(false);
  state.listener?.({ data: { closing: true } });
  expect(state.finished).toBe(false);
  state.listener?.({ data: { closing: false } });
  expect(useScreenTransitionReady()).toBe(true);
});

it('makes an initial or deep-linked root ready without waiting for an event', () => {
  state.index = 0;
  useScreenTransitionReady();
  expect(useScreenTransitionReady()).toBe(true);
});

it('cancels pending listeners and fallback work when the screen loses focus', () => {
  useScreenTransitionReady();
  state.focused = false;
  expect(useScreenTransitionReady()).toBe(false);
  vi.advanceTimersByTime(2000);
  expect(state.listener).toBeUndefined();
  expect(state.finished).toBe(false);
});

it('retains readiness while pausing optional work for a background screen', () => {
  useScreenTransitionReady();
  state.listener?.({ data: { closing: false } });
  expect(useScreenTransitionReady()).toBe(true);
  state.focused = false;
  expect(useScreenTransitionReady()).toBe(false);
  state.focused = true;
  expect(useScreenTransitionReady()).toBe(true);
});

it('recovers when a cancelled native opening never sends transitionEnd', () => {
  expect(useScreenTransitionReady()).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(useScreenTransitionReady()).toBe(true);
});
