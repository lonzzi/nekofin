import type { MediaChapter, MediaItem, MediaSegment } from './types';

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

// Explicit labels take precedence over optional duration-based inference.
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
  { inferAnimeChapters = false }: { inferAnimeChapters?: boolean } = {},
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
  const trusted = [...explicit, ...inferred];
  const byDuration = inferAnimeChapters
    ? inferAnimeChapterSegments(ordered, durationMs).filter(
        (candidate) =>
          !trusted.some((segment) => segment.type === candidate.type) &&
          !ordered.some(
            (chapter) =>
              chapterSegmentType(chapter.name) === candidate.type ||
              chapter.markerType === (candidate.type === 'Intro' ? 'IntroStart' : 'CreditsStart'),
          ),
      )
    : [];
  return [...trusted, ...byDuration].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

/** Only animation episodes qualify; an animated movie still needs explicit markers. */
export function isAnimeEpisode(
  item: Pick<MediaItem, 'type' | 'genres' | 'tags'> | null | undefined,
  series: Pick<MediaItem, 'genres' | 'tags'> | null | undefined,
) {
  return (
    item?.type === 'Episode' &&
    [
      ...(item.genres ?? []),
      ...(item.tags ?? []),
      ...(series?.genres ?? []),
      ...(series?.tags ?? []),
    ].some((genre) =>
      /^(?:animation|anime|动画|動畫|动漫|動漫|番剧|番劇|アニメ)$/i.test(genre.trim()),
    )
  );
}

function inferAnimeChapterSegments(chapters: MediaChapter[], durationMs: number): MediaSegment[] {
  const range =
    durationMs > 20 * 60_000
      ? [80_000, 95_000]
      : durationMs > 10 * 60_000
        ? [55_000, 65_000]
        : null;
  if (!range || durationMs > 60 * 60_000) return [];
  const ordinary = chapters.filter(
    (chapter, index) =>
      (!chapter.markerType || chapter.markerType === 'Chapter') &&
      chapter.startTimeMs < durationMs &&
      !chapters.slice(0, index).some((previous) => previous.startTimeMs === chapter.startTimeMs),
  );
  const candidates: MediaSegment[] = [];
  const edgeWindowMs = Math.min(5 * 60_000, durationMs / 4);
  for (const [index, chapter] of ordinary.entries()) {
    const name = chapter.name.normalize('NFKC').trim();
    // Generated numbers/timestamps carry no competing scene semantics.
    if (
      name &&
      !/^(?:(?:chapter|chap|ch|章节|章節)\s*\d+|\d+|(?:\d{1,2}:)?\d{2}:\d{2}(?:[.,]\d{1,3})?)$/i.test(
        name,
      )
    )
      continue;
    const endTimeMs = ordinary[index + 1]?.startTimeMs ?? durationMs;
    const lengthMs = endTimeMs - chapter.startTimeMs;
    if (lengthMs < range[0] || lengthMs > range[1]) continue;
    const type =
      endTimeMs <= edgeWindowMs
        ? 'Intro'
        : chapter.startTimeMs >= durationMs - edgeWindowMs && durationMs - endTimeMs <= 120_000
          ? 'Outro'
          : null;
    if (type) candidates.push({ type, startTimeMs: chapter.startTimeMs, endTimeMs });
  }
  // Several similarly sized scenes at one end are ambiguous.
  return candidates.filter(
    (candidate) => candidates.filter((entry) => entry.type === candidate.type).length === 1,
  );
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
