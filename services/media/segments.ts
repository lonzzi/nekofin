import type { MediaChapter, MediaSegment } from './types';

const TICKS_PER_MS = 10_000;
const validTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function mapMediaChapters(
  chapters?: { Name?: string | null; StartPositionTicks?: number; MarkerType?: string }[] | null,
): MediaChapter[] {
  return (chapters ?? [])
    .filter((chapter) => validTime(chapter.StartPositionTicks))
    .map((chapter) => ({
      name: chapter.Name?.trim() ?? '',
      startTimeMs: chapter.StartPositionTicks! / TICKS_PER_MS,
      ...(chapter.MarkerType ? { markerType: chapter.MarkerType } : {}),
    }))
    .sort((a, b) => a.startTimeMs - b.startTimeMs);
}

export function mapMediaSegments(
  segments?:
    | {
        Type?: string;
        StartTicks?: number;
        EndTicks?: number;
      }[]
    | null,
): MediaSegment[] {
  return (segments ?? []).flatMap((segment) =>
    (segment.Type === 'Intro' || segment.Type === 'Outro') &&
    validTime(segment.StartTicks) &&
    validTime(segment.EndTicks) &&
    segment.EndTicks > segment.StartTicks
      ? [
          {
            type: segment.Type,
            startTimeMs: segment.StartTicks / TICKS_PER_MS,
            endTimeMs: segment.EndTicks / TICKS_PER_MS,
          },
        ]
      : [],
  );
}

// Match explicit labels only; ordinary scene titles are never guessed by position.
function chapterSegmentType(name: string): MediaSegment['type'] | null {
  const label = name.normalize('NFKC').trim();
  if (
    /^(?:OP\d*|Opening(?: Theme)?|Intro|片头(?:曲)?|片頭(?:曲)?|オープニング)(?:$|\s*[:：\-–—(【])/i.test(
      label,
    )
  )
    return 'Intro';
  if (
    /^(?:ED\d*|Ending(?: Theme)?|Outro|End Credits|Credits|片尾(?:曲)?|エンディング)(?:$|\s*[:：\-–—(【])/i.test(
      label,
    )
  )
    return 'Outro';
  return null;
}

export function resolveMediaSegments(
  chapters: MediaChapter[],
  serverSegments: MediaSegment[],
  durationMs: number,
): MediaSegment[] {
  if (!validTime(durationMs) || durationMs === 0) return [];
  const ordered = chapters
    .filter((chapter) => validTime(chapter.startTimeMs))
    .sort((a, b) => a.startTimeMs - b.startTimeMs);
  const clamp = (segment: MediaSegment): MediaSegment[] => {
    const endTimeMs = Math.min(segment.endTimeMs, durationMs);
    return validTime(segment.startTimeMs) && validTime(endTimeMs) && endTimeMs > segment.startTimeMs
      ? [{ ...segment, endTimeMs }]
      : [];
  };
  const explicit = serverSegments.flatMap(clamp);
  const inferred = ordered.flatMap((chapter, index): MediaSegment[] => {
    const marker = chapter.markerType;
    const type =
      marker === 'IntroStart'
        ? 'Intro'
        : marker === 'CreditsStart'
          ? 'Outro'
          : marker && marker !== 'Chapter'
            ? null
            : chapterSegmentType(chapter.name);
    if (!type || explicit.some((segment) => segment.type === type)) return [];
    const endMarker =
      marker === 'IntroStart'
        ? ordered.slice(index + 1).find((next) => next.markerType === 'IntroEnd')
        : undefined;
    // An incomplete IntroStart marker has no trustworthy end boundary.
    if (marker === 'IntroStart' && !endMarker) return [];
    const nextChapter = ordered
      .slice(index + 1)
      .find(
        (next) =>
          next.startTimeMs > chapter.startTimeMs &&
          (!next.markerType || next.markerType === 'Chapter'),
      );
    if (type === 'Intro' && !endMarker && !nextChapter) return [];
    return clamp({
      type,
      startTimeMs: chapter.startTimeMs,
      endTimeMs: endMarker?.startTimeMs ?? nextChapter?.startTimeMs ?? durationMs,
    });
  });
  return [...explicit, ...inferred].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

export function segmentAtTime(segments: MediaSegment[], timeMs: number) {
  return segments.find((segment) => timeMs >= segment.startTimeMs && timeMs < segment.endTimeMs);
}

export function visibleChapters(chapters: MediaChapter[], durationMs: number) {
  return chapters.filter(
    (chapter, index) =>
      (!chapter.markerType || chapter.markerType === 'Chapter') &&
      validTime(chapter.startTimeMs) &&
      chapter.startTimeMs < durationMs &&
      !chapters
        .slice(0, index)
        .some(
          (previous) =>
            (!previous.markerType || previous.markerType === 'Chapter') &&
            previous.startTimeMs === chapter.startTimeMs,
        ),
  );
}
