import { describe, expect, it } from 'vitest';

import {
  INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE,
  PERFORMANCE_DIAGNOSTICS_TAP_THRESHOLD,
  PERFORMANCE_DIAGNOSTICS_TAP_WINDOW_MS,
  registerPerformanceDiagnosticsTap,
} from './performanceDiagnosticsUnlock';

describe('performance diagnostics unlock', () => {
  it('unlocks after enough taps inside the tap window', () => {
    let state = INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE;
    let didUnlock = false;

    for (let index = 0; index < PERFORMANCE_DIAGNOSTICS_TAP_THRESHOLD; index += 1) {
      const result = registerPerformanceDiagnosticsTap(state, 1000 + index * 100);
      state = result.state;
      didUnlock = result.didUnlock;
    }

    expect(didUnlock).toBe(true);
    expect(state).toEqual(INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE);
  });

  it('restarts the tap counter when the tap window expires', () => {
    let state = INITIAL_PERFORMANCE_DIAGNOSTICS_TAP_STATE;

    for (let index = 0; index < PERFORMANCE_DIAGNOSTICS_TAP_THRESHOLD - 1; index += 1) {
      state = registerPerformanceDiagnosticsTap(state, 1000 + index * 100).state;
    }

    const expiredTapAt = 1000 + PERFORMANCE_DIAGNOSTICS_TAP_WINDOW_MS + 1;
    const result = registerPerformanceDiagnosticsTap(state, expiredTapAt);

    expect(result.didUnlock).toBe(false);
    expect(result.state).toEqual({
      count: 1,
      startedAt: expiredTapAt,
    });
  });
});
