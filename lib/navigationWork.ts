import { AppState } from 'react-native';

const transitions = new Map<string, ReturnType<typeof setTimeout>>();
const waiting = new Set<() => void>();

function resumeWaitingWork() {
  if (transitions.size) return;
  for (const resume of [...waiting]) resume();
}

/** Native completion is authoritative; the timeout covers cancelled/unmounted stacks. */
export function beginNavigationTransition(key: string) {
  clearTimeout(transitions.get(key));
  transitions.set(
    key,
    setTimeout(() => finishNavigationTransition(key), 1000),
  );
}

export function finishNavigationTransition(key: string) {
  clearTimeout(transitions.get(key));
  transitions.delete(key);
  resumeWaitingWork();
}

export function finishNavigationScope(scope: string) {
  for (const key of transitions.keys()) {
    if (key.startsWith(`${scope}:`)) {
      clearTimeout(transitions.get(key));
      transitions.delete(key);
    }
  }
  resumeWaitingWork();
}

/** Leave focus/route commits and native animations free to present before optional work. */
export function scheduleAfterNavigation(task: () => void) {
  let cancelled = false;
  let frame: number | undefined;
  let idle: number | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  const clearTurn = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (idle !== undefined) cancelIdleCallback(idle);
    clearTimeout(fallback);
    frame = idle = undefined;
    fallback = undefined;
  };
  const run = () => {
    clearTurn();
    if (cancelled) return;
    if (AppState.currentState === 'active' && transitions.size) {
      waiting.add(schedule);
      return;
    }
    cancelled = true;
    waiting.delete(schedule);
    task();
  };
  const schedule = () => {
    if (cancelled) return;
    waiting.delete(schedule);
    clearTurn();
    // RAF/idle callbacks pause in the background; cache writes must still finish.
    fallback = setTimeout(run, AppState.currentState === 'active' ? 250 : 0);
    if (AppState.currentState !== 'active') return;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        idle = requestIdleCallback(run, { timeout: 250 });
      });
    });
  };
  schedule();
  return {
    cancel() {
      cancelled = true;
      waiting.delete(schedule);
      clearTurn();
    },
  };
}

export function yieldToNavigationIdle() {
  return new Promise<void>((resolve) => scheduleAfterNavigation(resolve));
}
