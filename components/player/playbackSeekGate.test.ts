import { describe, expect, it } from 'vitest';

import {
  acknowledgePlaybackSeek,
  createPlaybackSeekGateState,
  evaluatePlaybackProgress,
  failPlaybackSeek,
  recoverTimedOutPlaybackSeek,
  requestPlaybackSeek,
  resolvePlaybackSeekCommand,
} from './playbackSeekGate';

const progress = (
  state: ReturnType<typeof createPlaybackSeekGateState>,
  positionTimeMs: number,
  wallTimeMs: number,
  playbackRate = 1,
) =>
  evaluatePlaybackProgress({
    isPlaying: true,
    playbackRate,
    positionTimeMs,
    state,
    wallTimeMs,
  });

describe('playbackSeekGate', () => {
  it('rejects old progress until the requested target is reached', () => {
    const requested = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100);
    const rejected = progress(requested, 10_250, 350);

    expect(rejected.accepted).toBe(false);
    expect(rejected.state.pendingSeek?.targetTimeMs).toBe(30_000);
  });

  it('accepts a high-rate sample that has advanced beyond the target', () => {
    const requested = acknowledgePlaybackSeek(
      requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100),
    );
    const accepted = progress(requested, 31_000, 600, 2);

    expect(accepted.accepted).toBe(true);
    expect(accepted.completion).toMatchObject({
      cursorTimeMs: 31_000,
      playbackTimeMs: 31_000,
    });
  });

  it('uses the last confirmed native position across rapid consecutive seeks', () => {
    const confirmed = createPlaybackSeekGateState(10_000, 0);
    const first = requestPlaybackSeek(confirmed, 50_000, 100);
    const second = acknowledgePlaybackSeek(requestPlaybackSeek(first, 30_000, 200));

    expect(second.pendingSeek?.originTimeMs).toBe(10_000);
    expect(progress(second, 10_000, 300).accepted).toBe(false);
    expect(progress(second, 50_000, 300).accepted).toBe(false);
    expect(progress(second, 30_500, 700).accepted).toBe(true);
  });

  it('estimates a high-rate seek origin from the confirmed media clock', () => {
    const requested = acknowledgePlaybackSeek(
      requestPlaybackSeek(createPlaybackSeekGateState(10_000, 1000), 10_500, 1500, {
        isPlaying: true,
        playbackRate: 4,
      }),
    );

    expect(requested.pendingSeek?.originTimeMs).toBe(12_000);
    expect(progress(requested, 12_000, 1550, 4).accepted).toBe(false);

    const completed = progress(requested, 10_500, 1550, 4);
    expect(completed.accepted).toBe(true);
    expect(completed.completion).toMatchObject({
      cursorTimeMs: 10_500,
      playbackTimeMs: 10_500,
    });
  });

  it('does not extrapolate an origin before a native progress clock is established', () => {
    const requested = requestPlaybackSeek(createPlaybackSeekGateState(0, 0), 30_000, 10_000, {
      isPlaying: true,
      playbackRate: 4,
    });

    expect(requested.pendingSeek?.originTimeMs).toBe(0);
  });

  it('quarantines a stale pre-seek sample at high playback rate', () => {
    const requested = acknowledgePlaybackSeek(
      requestPlaybackSeek(createPlaybackSeekGateState(10_000, 1000), 10_500, 1500, {
        isPlaying: true,
        playbackRate: 4,
      }),
    );
    const completed = progress(requested, 10_500, 1550, 4);
    const stalePreSeek = progress(completed.state, 12_000, 1600, 4);
    const currentPlayback = progress(completed.state, 10_700, 1600, 4);

    expect(stalePreSeek.accepted).toBe(false);
    expect(currentPlayback.accepted).toBe(true);
  });

  it('quarantines a late old sample after seek completion', () => {
    const requested = acknowledgePlaybackSeek(
      requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100),
    );
    const completed = progress(requested, 30_500, 600);
    const lateOld = progress(completed.state, 10_500, 650);
    const nextValid = progress(completed.state, 31_000, 1100);

    expect(completed.accepted).toBe(true);
    expect(lateOld.accepted).toBe(false);
    expect(nextValid.accepted).toBe(true);
  });

  it('resumes the danmaku cursor at the accepted native position without catch-up bursts', () => {
    const requested = acknowledgePlaybackSeek(
      requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100),
    );
    const completed = progress(requested, 31_000, 600, 2);

    expect(completed.completion).toMatchObject({
      cursorTimeMs: 31_000,
      playbackTimeMs: 31_000,
      targetTimeMs: 30_000,
    });
  });

  it('recovers an acknowledged timeout at the target, not rejected progress', () => {
    const requested = acknowledgePlaybackSeek(
      requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100),
    );
    const rejected = progress(requested, 10_250, 350);
    const recovered = recoverTimedOutPlaybackSeek(rejected.state, 1, 2600);

    expect(recovered.completion).toMatchObject({
      cursorTimeMs: 30_000,
      playbackTimeMs: 30_000,
    });
  });

  it('recovers a missing callback once a target sample arrives after the grace period', () => {
    const requested = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100);

    expect(progress(requested, 30_500, 800).accepted).toBe(true);
  });

  it('falls back to the confirmed origin when the seek command rejects', () => {
    const requested = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100);
    const failed = failPlaybackSeek(requested, 1, 200);

    expect(failed.completion).toMatchObject({
      cursorTimeMs: 10_000,
      playbackTimeMs: 10_000,
    });
  });

  it('ignores stale resolve and failure callbacks from an earlier seek generation', () => {
    const first = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 50_000, 100);
    const second = requestPlaybackSeek(first, 30_000, 200);

    expect(resolvePlaybackSeekCommand(second, 1)).toBe(second);
    expect(failPlaybackSeek(second, 1, 300)).toEqual({ completion: null, state: second });
  });

  it('preserves the generation across a source reset', () => {
    const first = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 50_000, 100);
    const reset = createPlaybackSeekGateState(0, 200, first.generation);
    const second = requestPlaybackSeek(reset, 30_000, 300);

    expect(reset.generation).toBe(1);
    expect(second.generation).toBe(2);
    expect(second.pendingSeek?.generation).toBe(2);
    expect(resolvePlaybackSeekCommand(second, 1)).toBe(second);
    expect(failPlaybackSeek(second, 1, 400)).toEqual({ completion: null, state: second });
  });

  it('uses a resolved command as the watchdog fallback when onSeek is absent', () => {
    const requested = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 0), 30_000, 100);
    const resolved = resolvePlaybackSeekCommand(requested, 1);
    const recovered = recoverTimedOutPlaybackSeek(resolved, 1, 2600);

    expect(recovered.completion?.playbackTimeMs).toBe(30_000);
  });

  it('keeps the estimated origin when a playing source never produces seek progress', () => {
    const requested = requestPlaybackSeek(createPlaybackSeekGateState(10_000, 1000), 30_000, 1100, {
      isPlaying: true,
      playbackRate: 2,
    });
    const resolved = resolvePlaybackSeekCommand(requested, 1);
    const recovered = recoverTimedOutPlaybackSeek(resolved, 1, 3600, {
      trustResolvedCommand: false,
    });

    expect(recovered.completion?.playbackTimeMs).toBe(10_200);
  });
});
