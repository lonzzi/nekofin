import type { MediaSegment } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import { automaticSegmentSeekTarget, createPlayerSegmentSkip } from './playerSegmentSkip';

const segments: MediaSegment[] = [
  { type: 'Intro', startTimeMs: 101018, endTimeMs: 190981 },
  { type: 'Outro', startTimeMs: 1330078, endTimeMs: 1420043 },
];

describe('automatic chapter skipping', () => {
  it('waits for playback to settle after loading or a buffering transition', () => {
    let now = 0;
    const skip = createPlayerSegmentSkip({ now: () => now });
    skip.defer();
    now = 1400;
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toBeNull();
    skip.defer();
    now = 2800;
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toBeNull();
    now = 2900;
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toEqual(segments[0]);
  });
  it('obeys independent defaults and only triggers inside a segment', () => {
    const skip = createPlayerSegmentSkip();
    expect(skip.claim(segments, 102000, { intro: false, outro: false })).toBeNull();
    expect(skip.claim(segments, 100000, { intro: true, outro: true })).toBeNull();
    expect(skip.claim(segments, 191000, { intro: true, outro: true })).toBeNull();
    expect(skip.claim(segments, 1331000, { intro: true, outro: false })).toBeNull();
    expect(skip.claim(segments, 101018, { intro: true, outro: false })).toEqual(segments[0]);
  });

  it('claims once despite duplicate progress and allows manual replay', () => {
    const skip = createPlayerSegmentSkip();
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toEqual(segments[0]);
    expect(skip.claim(segments, 111000, { intro: true, outro: true })).toBeNull();
    expect(skip.claim(segments, 101018, { intro: true, outro: true })).toBeNull();
    expect(skip.claim(segments, 1331000, { intro: true, outro: true })).toEqual(segments[1]);
  });

  it('respects an explicit manual seek into an unplayed segment', () => {
    const skip = createPlayerSegmentSkip();
    skip.handleManualSeek(segments, 1335000);
    expect(skip.claim(segments, 1335100, { intro: true, outro: true })).toBeNull();
    expect(skip.claim(segments, 105000, { intro: true, outro: true })).toEqual(segments[0]);
  });

  it('uses a fresh skip history for a new playback item', () => {
    const first = createPlayerSegmentSkip();
    first.claim(segments, 110000, { intro: true, outro: true });
    expect(createPlayerSegmentSkip().claim(segments, 110000, { intro: true, outro: true })).toEqual(
      segments[0],
    );
  });

  it('retries a failed seek after a delay and records only a confirmed skip as handled', () => {
    let now = 0;
    const skip = createPlayerSegmentSkip({ now: () => now });
    const first = skip.claim(segments, 110000, { intro: true, outro: true })!;
    skip.fail(first);
    expect(skip.claim(segments, 110500, { intro: true, outro: true })).toBeNull();
    now = 1500;
    const retry = skip.claim(segments, 111500, { intro: true, outro: true })!;
    expect(retry).toEqual(segments[0]);
    skip.confirm(retry);
    now = 10000;
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toBeNull();
  });

  it('ignores stale seek failures after a new attempt starts', () => {
    let now = 0;
    const skip = createPlayerSegmentSkip({ now: () => now });
    const first = skip.claim(segments, 110000, { intro: true, outro: true })!;
    skip.fail(first);
    now = 1500;
    const retry = skip.claim(segments, 111500, { intro: true, outro: true })!;
    skip.fail(first);
    skip.confirm(retry);
    now = 10000;
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toBeNull();
  });

  it('preserves manual replay even when an automatic seek fails afterwards', () => {
    const skip = createPlayerSegmentSkip();
    const first = skip.claim(segments, 110000, { intro: true, outro: true })!;
    skip.handleManualSeek(segments, 105000);
    skip.fail(first);
    expect(skip.claim(segments, 105000, { intro: true, outro: true })).toBeNull();
  });

  it('preserves manual replay when optional segment metadata arrives after seeking', () => {
    const skip = createPlayerSegmentSkip();
    skip.handleManualSeek([], 105000);
    expect(skip.claim(segments, 106000, { intro: true, outro: true })).toBeNull();
    expect(skip.claim(segments, 1331000, { intro: true, outro: true })).toEqual(segments[1]);
  });

  it('bounds retries to avoid repeatedly interrupting playback on a broken stream', () => {
    let now = 0;
    const skip = createPlayerSegmentSkip({ now: () => now });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const claim = skip.claim(segments, 110000, { intro: true, outro: true })!;
      expect(claim).toEqual(segments[0]);
      skip.fail(claim);
      now += 1500;
    }
    expect(skip.claim(segments, 110000, { intro: true, outro: true })).toBeNull();
  });

  it('can skip an enabled outro even when it overlaps a disabled intro', () => {
    const overlap = { ...segments[0], type: 'Outro' as const };
    expect(
      createPlayerSegmentSkip().claim([segments[0], overlap], 110000, {
        intro: false,
        outro: true,
      }),
    ).toEqual(overlap);
  });

  it('retains a short EOF tail for auto-next while preserving post-credit scenes', () => {
    expect(
      automaticSegmentSeekTarget(
        { type: 'Outro', startTimeMs: 1300000, endTimeMs: 1430000 },
        1430000,
      ),
    ).toBe(1428000);
    expect(automaticSegmentSeekTarget(segments[1], 1430000)).toBe(segments[1].endTimeMs);
  });
});
