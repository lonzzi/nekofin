import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  beginNavigationTransition,
  finishNavigationScope,
  finishNavigationTransition,
  scheduleAfterNavigation,
} from './navigationWork';

const state = vi.hoisted(() => ({ currentState: 'active' }));
vi.mock('react-native', () => ({ AppState: state }));

beforeEach(() => {
  vi.useFakeTimers();
  state.currentState = 'active';
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('requestIdleCallback', (fn: () => void) => setTimeout(fn, 1));
  vi.stubGlobal('cancelIdleCallback', clearTimeout);
});
afterEach(() => {
  finishNavigationScope('test');
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('waits for route commits and native completion, including a transition arriving after focus', () => {
  const work = vi.fn();
  scheduleAfterNavigation(work);
  vi.advanceTimersByTime(16);
  beginNavigationTransition('test:player');
  vi.advanceTimersByTime(300);
  expect(work).not.toHaveBeenCalled();
  finishNavigationTransition('test:player');
  vi.advanceTimersByTime(33);
  expect(work).toHaveBeenCalledOnce();
});

it('does not resume while another native transition is active', () => {
  const work = vi.fn();
  beginNavigationTransition('test:root');
  beginNavigationTransition('test:child');
  scheduleAfterNavigation(work);
  vi.advanceTimersByTime(33);
  finishNavigationTransition('test:root');
  vi.advanceTimersByTime(100);
  expect(work).not.toHaveBeenCalled();
  finishNavigationTransition('test:child');
  vi.advanceTimersByTime(33);
  expect(work).toHaveBeenCalledOnce();
});

it('uses stack completion when the popped screen no longer receives transitionEnd', () => {
  const work = vi.fn();
  beginNavigationTransition('test:removed-player');
  scheduleAfterNavigation(work);
  vi.advanceTimersByTime(100);
  finishNavigationScope('test');
  vi.advanceTimersByTime(33);
  expect(work).toHaveBeenCalledOnce();
});

it('cancels an obsolete screen refresh while it is waiting for a pop', () => {
  const work = vi.fn();
  beginNavigationTransition('test:player');
  const task = scheduleAfterNavigation(work);
  vi.advanceTimersByTime(33);
  task.cancel();
  finishNavigationScope('test');
  vi.runAllTimers();
  expect(work).not.toHaveBeenCalled();
});

it('recovers if a cancelled native transition never reports completion', () => {
  const work = vi.fn();
  beginNavigationTransition('test:cancelled');
  scheduleAfterNavigation(work);
  vi.advanceTimersByTime(1033);
  expect(work).toHaveBeenCalledOnce();
});

it('allows background cache work to finish even when RAF and idle callbacks stop', () => {
  const work = vi.fn();
  beginNavigationTransition('test:player');
  scheduleAfterNavigation(work);
  state.currentState = 'background';
  vi.advanceTimersByTime(250);
  expect(work).toHaveBeenCalledOnce();
});
