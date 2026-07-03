export const PERFORMANCE_DIAGNOSTICS_TAP_THRESHOLD = 7;
export const PERFORMANCE_DIAGNOSTICS_TAP_WINDOW_MS = 3000;

export type PerformanceDiagnosticsTapState = {
  count: number;
  startedAt: number;
};

export const INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE: PerformanceDiagnosticsTapState = {
  count: 0,
  startedAt: 0,
};

export function registerPerformanceDiagnosticsTap(
  current: PerformanceDiagnosticsTapState,
  now: number,
) {
  const nextCount =
    current.count > 0 && now - current.startedAt <= PERFORMANCE_DIAGNOSTICS_TAP_WINDOW_MS
      ? current.count + 1
      : 1;
  const nextState: PerformanceDiagnosticsTapState = {
    count: nextCount,
    startedAt: nextCount === 1 ? now : current.startedAt,
  };

  if (nextCount < PERFORMANCE_DIAGNOSTICS_TAP_THRESHOLD) {
    return {
      didUnlock: false,
      state: nextState,
    };
  }

  return {
    didUnlock: true,
    state: INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE,
  };
}
