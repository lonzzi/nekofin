import type { MediaSegment } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import { createPlayerSegmentSkip } from './playerSegmentSkip';

const segments: MediaSegment[] = [
  { type: 'Intro', startTimeMs: 101018, endTimeMs: 190981 },
  { type: 'Outro', startTimeMs: 1330078, endTimeMs: 1420043 },
];

describe('automatic chapter skipping', () => {
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
});
