export const PLAYBACK_SEEK_SIGNAL_GRACE_MS = 600;
export const PLAYBACK_SEEK_WATCHDOG_MS = 2500;
export const PLAYBACK_POST_SEEK_GUARD_MS = 1500;

export type PendingPlaybackSeek = {
  acknowledged: boolean;
  commandResolved: boolean;
  generation: number;
  originTimeMs: number;
  requestedWallTimeMs: number;
  targetTimeMs: number;
};

export type PlaybackSeekGateState = {
  confirmedPositionTimeMs: number;
  confirmedWallTimeMs: number;
  generation: number;
  guardExpiresWallTimeMs: number;
  pendingSeek: PendingPlaybackSeek | null;
};

export type PlaybackSeekCompletion = {
  cursorTimeMs: number;
  generation: number;
  playbackTimeMs: number;
  targetTimeMs: number;
};

export type PlaybackProgressDecision = {
  accepted: boolean;
  completion: PlaybackSeekCompletion | null;
  state: PlaybackSeekGateState;
};

export type PlaybackSeekRequestOptions = {
  isPlaying?: boolean;
  playbackRate?: number;
};

const normalizePlaybackRate = (playbackRate: number) => {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return 1;
  return Math.max(0.25, playbackRate);
};

const normalizeTimeMs = (timeMs: number, fallback = 0) =>
  Math.max(0, Number.isFinite(timeMs) ? timeMs : fallback);

export function createPlaybackSeekGateState(
  positionTimeMs = 0,
  wallTimeMs = 0,
  generation = 0,
): PlaybackSeekGateState {
  return {
    confirmedPositionTimeMs: normalizeTimeMs(positionTimeMs),
    confirmedWallTimeMs: Math.max(0, wallTimeMs),
    generation: Math.max(0, Number.isFinite(generation) ? Math.floor(generation) : 0),
    guardExpiresWallTimeMs: 0,
    pendingSeek: null,
  };
}

export function requestPlaybackSeek(
  state: PlaybackSeekGateState,
  targetTimeMs: number,
  wallTimeMs: number,
  { isPlaying = false, playbackRate = 1 }: PlaybackSeekRequestOptions = {},
): PlaybackSeekGateState {
  const generation = state.generation + 1;
  const safeRate = normalizePlaybackRate(playbackRate);
  const elapsedSinceConfirmedMs = Math.max(0, wallTimeMs - state.confirmedWallTimeMs);
  const canEstimateOrigin =
    isPlaying && state.confirmedWallTimeMs > 0 && Number.isFinite(wallTimeMs);
  const estimatedOriginTimeMs = canEstimateOrigin
    ? state.confirmedPositionTimeMs + elapsedSinceConfirmedMs * safeRate
    : state.confirmedPositionTimeMs;
  return {
    ...state,
    generation,
    guardExpiresWallTimeMs: 0,
    pendingSeek: {
      acknowledged: false,
      commandResolved: false,
      generation,
      originTimeMs: estimatedOriginTimeMs,
      requestedWallTimeMs: wallTimeMs,
      targetTimeMs: normalizeTimeMs(targetTimeMs, estimatedOriginTimeMs),
    },
  };
}

export function acknowledgePlaybackSeek(state: PlaybackSeekGateState): PlaybackSeekGateState {
  if (!state.pendingSeek) return state;
  return {
    ...state,
    pendingSeek: { ...state.pendingSeek, acknowledged: true },
  };
}

export function resolvePlaybackSeekCommand(
  state: PlaybackSeekGateState,
  generation: number,
): PlaybackSeekGateState {
  if (!state.pendingSeek || state.pendingSeek.generation !== generation) return state;
  return {
    ...state,
    pendingSeek: { ...state.pendingSeek, commandResolved: true },
  };
}

const isPendingSeekProgressReady = ({
  pendingSeek,
  playbackRate,
  positionTimeMs,
  wallTimeMs,
}: {
  pendingSeek: PendingPlaybackSeek;
  playbackRate: number;
  positionTimeMs: number;
  wallTimeMs: number;
}) => {
  const elapsedWallTimeMs = Math.max(0, wallTimeMs - pendingSeek.requestedWallTimeMs);
  if (!pendingSeek.acknowledged && elapsedWallTimeMs < PLAYBACK_SEEK_SIGNAL_GRACE_MS) {
    return false;
  }

  const safeRate = normalizePlaybackRate(playbackRate);
  const direction = Math.sign(pendingSeek.targetTimeMs - pendingSeek.originTimeMs);
  const distanceMs = Math.abs(pendingSeek.targetTimeMs - pendingSeek.originTimeMs);
  const targetToleranceMs = Math.max(250, 250 * safeRate);
  const maximumOvershootMs = Math.max(
    750,
    elapsedWallTimeMs * safeRate + Math.max(750, 300 * safeRate),
  );

  if (direction === 0) {
    return Math.abs(positionTimeMs - pendingSeek.targetTimeMs) <= maximumOvershootMs;
  }

  const movementThresholdMs = Math.min(100, Math.max(10, distanceMs * 0.25));
  if (direction > 0) {
    return (
      positionTimeMs >= pendingSeek.originTimeMs + movementThresholdMs &&
      positionTimeMs >= pendingSeek.targetTimeMs - targetToleranceMs &&
      positionTimeMs <= pendingSeek.targetTimeMs + maximumOvershootMs
    );
  }

  return (
    positionTimeMs <= pendingSeek.originTimeMs - movementThresholdMs &&
    positionTimeMs <= pendingSeek.targetTimeMs + targetToleranceMs &&
    positionTimeMs >= pendingSeek.targetTimeMs - maximumOvershootMs
  );
};

export function evaluatePlaybackProgress({
  isPlaying,
  playbackRate,
  positionTimeMs,
  state,
  wallTimeMs,
}: {
  isPlaying: boolean;
  playbackRate: number;
  positionTimeMs: number;
  state: PlaybackSeekGateState;
  wallTimeMs: number;
}): PlaybackProgressDecision {
  if (!Number.isFinite(positionTimeMs) || positionTimeMs < 0) {
    return { accepted: false, completion: null, state };
  }

  const pendingSeek = state.pendingSeek;
  if (pendingSeek) {
    if (
      !isPendingSeekProgressReady({
        pendingSeek,
        playbackRate,
        positionTimeMs,
        wallTimeMs,
      })
    ) {
      return { accepted: false, completion: null, state };
    }

    const nextState: PlaybackSeekGateState = {
      ...state,
      confirmedPositionTimeMs: positionTimeMs,
      confirmedWallTimeMs: wallTimeMs,
      guardExpiresWallTimeMs: wallTimeMs + PLAYBACK_POST_SEEK_GUARD_MS,
      pendingSeek: null,
    };
    return {
      accepted: true,
      completion: {
        // Resume the danmaku cursor at the native position that was actually
        // accepted. Replaying target→actual in one scheduler turn creates a
        // visible burst when high-rate playback overshoots the seek target.
        cursorTimeMs: positionTimeMs,
        generation: pendingSeek.generation,
        playbackTimeMs: positionTimeMs,
        targetTimeMs: pendingSeek.targetTimeMs,
      },
      state: nextState,
    };
  }

  if (wallTimeMs < state.guardExpiresWallTimeMs) {
    const safeRate = normalizePlaybackRate(playbackRate);
    const elapsedWallTimeMs = Math.max(0, wallTimeMs - state.confirmedWallTimeMs);
    const maximumBackwardJitterMs = Math.max(300, 250 * safeRate);
    const maximumForwardAdvanceMs =
      (isPlaying ? elapsedWallTimeMs * safeRate : 0) + Math.max(500, 250 * safeRate);
    if (
      positionTimeMs < state.confirmedPositionTimeMs - maximumBackwardJitterMs ||
      positionTimeMs > state.confirmedPositionTimeMs + maximumForwardAdvanceMs
    ) {
      return { accepted: false, completion: null, state };
    }
  }

  return {
    accepted: true,
    completion: null,
    state: {
      ...state,
      confirmedPositionTimeMs: positionTimeMs,
      confirmedWallTimeMs: wallTimeMs,
    },
  };
}

function finishPendingPlaybackSeek(
  state: PlaybackSeekGateState,
  generation: number,
  playbackTimeMs: number,
  cursorTimeMs: number,
  wallTimeMs: number,
): { completion: PlaybackSeekCompletion | null; state: PlaybackSeekGateState } {
  const pendingSeek = state.pendingSeek;
  if (!pendingSeek || pendingSeek.generation !== generation) {
    return { completion: null, state };
  }

  const safePlaybackTimeMs = normalizeTimeMs(playbackTimeMs, pendingSeek.originTimeMs);
  const safeCursorTimeMs = normalizeTimeMs(cursorTimeMs, safePlaybackTimeMs);
  return {
    completion: {
      cursorTimeMs: safeCursorTimeMs,
      generation,
      playbackTimeMs: safePlaybackTimeMs,
      targetTimeMs: pendingSeek.targetTimeMs,
    },
    state: {
      ...state,
      confirmedPositionTimeMs: safePlaybackTimeMs,
      confirmedWallTimeMs: wallTimeMs,
      guardExpiresWallTimeMs: wallTimeMs + PLAYBACK_POST_SEEK_GUARD_MS,
      pendingSeek: null,
    },
  };
}

export function recoverTimedOutPlaybackSeek(
  state: PlaybackSeekGateState,
  generation: number,
  wallTimeMs: number,
  { trustResolvedCommand = true }: { trustResolvedCommand?: boolean } = {},
) {
  const pendingSeek = state.pendingSeek;
  if (!pendingSeek || pendingSeek.generation !== generation) {
    return { completion: null, state };
  }

  const acceptedByNative =
    pendingSeek.acknowledged || (pendingSeek.commandResolved && trustResolvedCommand);
  const fallbackTimeMs = acceptedByNative ? pendingSeek.targetTimeMs : pendingSeek.originTimeMs;
  return finishPendingPlaybackSeek(state, generation, fallbackTimeMs, fallbackTimeMs, wallTimeMs);
}

export function failPlaybackSeek(
  state: PlaybackSeekGateState,
  generation: number,
  wallTimeMs: number,
) {
  const pendingSeek = state.pendingSeek;
  if (!pendingSeek || pendingSeek.generation !== generation) {
    return { completion: null, state };
  }

  return finishPendingPlaybackSeek(
    state,
    generation,
    pendingSeek.originTimeMs,
    pendingSeek.originTimeMs,
    wallTimeMs,
  );
}
