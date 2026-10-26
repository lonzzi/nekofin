import { segmentAtTime } from '@/services/media/segments';
import type { MediaSegment } from '@/services/media/types';

/** One automatic skip per range; seeking back explicitly lets the viewer watch it. */
export function createPlayerSegmentSkip() {
  const handled = new Set<string>();
  const key = (segment: MediaSegment) =>
    `${segment.type}:${segment.startTimeMs}:${segment.endTimeMs}`;
  return {
    handleManualSeek(segments: MediaSegment[], timeMs: number) {
      const segment = segmentAtTime(segments, timeMs);
      if (segment) handled.add(key(segment));
    },
    claim(
      segments: MediaSegment[],
      timeMs: number,
      preferences: { intro: boolean; outro: boolean },
    ) {
      const segment = segmentAtTime(segments, timeMs);
      if (
        !segment ||
        !preferences[segment.type === 'Intro' ? 'intro' : 'outro'] ||
        handled.has(key(segment))
      )
        return null;
      handled.add(key(segment));
      return segment;
    },
  };
}
