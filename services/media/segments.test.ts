import { describe, expect, it } from 'vitest';

import { mapRawItemToMediaItem } from './mappers';
import {
  mapMediaChapters,
  mapMediaSegments,
  resolveMediaSegments,
  visibleChapters,
} from './segments';

// Anime chapter layout with a cold open and a preview after the ending.
const chapters = mapMediaChapters([
  { Name: 'Avant', StartPositionTicks: 0 },
  { Name: 'Opening', StartPositionTicks: 1010180000 },
  { Name: 'CHAPTER01', StartPositionTicks: 1909810000 },
  { Name: 'Ending', StartPositionTicks: 13300780000 },
  { Name: 'Next Episode', StartPositionTicks: 14200430000 },
]);
const duration = 1430054;

describe('media chapters and skip ranges', () => {
  it('preserves imported chapters for both item adapters, sorting valid timestamps', () => {
    const item = mapRawItemToMediaItem({
      Id: 'episode',
      Chapters: [
        { Name: 'Ending', StartPositionTicks: 20_000_000 },
        { Name: 'Opening', StartPositionTicks: 0 },
        { Name: 'bad', StartPositionTicks: -1 },
        { Name: 'bad', StartPositionTicks: NaN },
        { Name: 'missing' },
      ],
    });
    expect(item.chapters).toEqual([
      { name: 'Opening', startTimeMs: 0 },
      { name: 'Ending', startTimeMs: 2000 },
    ]);
  });

  it('skips only the opening and ending and keeps the following preview', () => {
    expect(resolveMediaSegments(chapters, [], duration)).toEqual([
      { type: 'Intro', startTimeMs: 101018, endTimeMs: 190981 },
      { type: 'Outro', startTimeMs: 1330078, endTimeMs: 1420043 },
    ]);
  });

  it('resolves unsorted chapter input without modifying the item metadata', () => {
    const reversed = [...chapters].reverse();
    const original = [...reversed];
    expect(resolveMediaSegments(reversed, [], duration)).toEqual(
      resolveMediaSegments(chapters, [], duration),
    );
    expect(reversed).toEqual(original);
  });

  it.each(['Chapter 1', 'Introduction to Magic', 'Episode 01', 'Next Episode', 'Avante', 'OP End'])(
    'does not infer a skip from %s',
    (name) => {
      expect(resolveMediaSegments([{ name, startTimeMs: 0 }], [], duration)).toEqual([]);
    },
  );

  it.each(['OP', 'OP1', 'Opening', 'ＯＰ', '片头', '片頭曲', 'オープニング'])(
    'recognizes explicit intro label %s',
    (name) => {
      expect(
        resolveMediaSegments(
          [
            { name, startTimeMs: 0 },
            { name: 'Part A', startTimeMs: 90000 },
          ],
          [],
          duration,
        ),
      ).toEqual([{ type: 'Intro', startTimeMs: 0, endTimeMs: 90000 }]);
    },
  );

  it('prefers server segments per type, retaining chapter fallback for other types', () => {
    expect(
      resolveMediaSegments(
        chapters,
        [{ type: 'Intro', startTimeMs: 105000, endTimeMs: 190000 }],
        duration,
      ),
    ).toEqual([
      { type: 'Intro', startTimeMs: 105000, endTimeMs: 190000 },
      { type: 'Outro', startTimeMs: 1330078, endTimeMs: 1420043 },
    ]);
  });

  it('ignores malformed server segments and recaps; clamps ends to the media duration', () => {
    const mapped = mapMediaSegments([
      { Type: 'Intro', StartTicks: 0, EndTicks: 900000000 },
      { Type: 'Outro', StartTicks: 13000000000, EndTicks: 15000000000 },
      { Type: 'Recap', StartTicks: 0, EndTicks: 900000000 },
      { Type: 'Intro', StartTicks: 3, EndTicks: 2 },
      { Type: 'Outro', StartTicks: NaN, EndTicks: 3 },
    ]);
    expect(resolveMediaSegments([], mapped, duration)).toEqual([
      { type: 'Intro', startTimeMs: 0, endTimeMs: 90000 },
      { type: 'Outro', startTimeMs: 1300000, endTimeMs: duration },
    ]);
  });

  it('supports Emby start/end markers independently of chapter names', () => {
    const marked = mapMediaChapters([
      { Name: 'Scene 1', StartPositionTicks: 0, MarkerType: 'Chapter' },
      { StartPositionTicks: 100000000, MarkerType: 'IntroStart' },
      { StartPositionTicks: 1000000000, MarkerType: 'IntroEnd' },
      { StartPositionTicks: 13000000000, MarkerType: 'CreditsStart' },
      { Name: 'Preview', StartPositionTicks: 14000000000, MarkerType: 'Chapter' },
    ]);
    expect(resolveMediaSegments(marked, [], duration)).toEqual([
      { type: 'Intro', startTimeMs: 10000, endTimeMs: 100000 },
      { type: 'Outro', startTimeMs: 1300000, endTimeMs: 1400000 },
    ]);
    expect(visibleChapters(marked, duration).map((chapter) => chapter.name)).toEqual([
      'Scene 1',
      'Preview',
    ]);
  });

  it('ignores incomplete markers and hides duplicate or out-of-range chapter points', () => {
    expect(
      resolveMediaSegments([{ name: '', markerType: 'IntroStart', startTimeMs: 10 }], [], duration),
    ).toEqual([]);
    expect(
      visibleChapters(
        [...chapters, chapters[0], { name: 'Past end', startTimeMs: duration }],
        duration,
      ),
    ).toEqual(chapters);
    expect(resolveMediaSegments(chapters, [], 0)).toEqual([]);
  });
});
