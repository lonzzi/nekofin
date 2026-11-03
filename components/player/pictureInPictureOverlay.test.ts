import type { DanmakuSettingsType } from '@/lib/contexts/DanmakuSettingsContext';
import type { DandanComment } from '@/services/dandanplay';
import { describe, expect, it } from 'vitest';

import { createPictureInPictureOverlay } from './pictureInPictureOverlay';

const settings: DanmakuSettingsType = {
  enabled: true,
  opacity: 0.8,
  speed: 140,
  fontSize: 20,
  heightRatio: 0.9,
  danmakuFilter: 0,
  danmakuModeFilter: 0,
  danmakuDensityLimit: 0,
  collisionPolicy: 'avoid',
  curEpOffset: 0,
  fontFamily: 'sans-serif',
  fontWeight: '700',
};
const comment = (overrides: Partial<DandanComment> = {}): DandanComment => ({
  id: 1,
  timeInSeconds: 10,
  text: '画中画弹幕',
  colorHex: '#ffcc00',
  mode: 1,
  user: '[BiliBili]',
  ...overrides,
});

describe('native PiP danmaku timeline', () => {
  it('disables the overlay with the existing danmaku toggle', () => {
    expect(createPictureInPictureOverlay([comment()], { ...settings, enabled: false })).toBeNull();
    expect(
      createPictureInPictureOverlay([comment()], { ...settings, danmakuFilter: 15 }),
    ).toBeNull();
  });

  it('preserves source/mode filters, offsets and colors on the media timeline', () => {
    const result = createPictureInPictureOverlay(
      [
        comment(),
        comment({ id: 2, user: 'local', mode: 5 }),
        comment({ id: 3, user: 'local', timeInSeconds: 5 }),
      ],
      { ...settings, danmakuFilter: 1, danmakuModeFilter: 2, curEpOffset: 2 },
    );
    expect(result?.cues).toHaveLength(1);
    expect(result?.cues[0]).toMatchObject({ start: 7, text: '画中画弹幕', color: '#ffcc00' });
    expect(result!.cues[0].end).toBeGreaterThan(7);
    expect(result!.cues[0].endX).toBeLessThan(result!.cues[0].startX);
  });

  it('retains both scroll directions and fixed top/bottom placement', () => {
    const result = createPictureInPictureOverlay(
      [1, 6, 5, 4].map((mode, index) =>
        comment({ id: index, timeInSeconds: index * 10, mode: mode as DandanComment['mode'] }),
      ),
      settings,
    )!;
    const [scroll, reverse, top, bottom] = result.cues;
    expect(scroll.startX).toBeGreaterThan(scroll.endX);
    expect(reverse.startX).toBeLessThan(reverse.endX);
    expect(top.startX).toBe(top.endX);
    expect(bottom.startX).toBe(bottom.endX);
    expect(bottom.y).toBeGreaterThan(top.y);
    expect(top.end - top.start).toBe(4);
  });

  it('drops overflow without delaying it into later media time and does not mutate input', () => {
    const comments = Array.from({ length: 1000 }, (_, id) => comment({ id }));
    const before = structuredClone(comments);
    const result = createPictureInPictureOverlay(comments, settings)!;
    expect(result.cues.length).toBeGreaterThan(0);
    expect(result.cues.length).toBeLessThanOrEqual(6);
    expect(result.cues.every((cue) => cue.start === 10)).toBe(true);
    expect(comments).toEqual(before);
  });

  it('rejects invalid timestamps and comments shifted before playback starts', () => {
    const result = createPictureInPictureOverlay(
      [
        comment({ timeInSeconds: Number.NaN }),
        comment({ timeInSeconds: Infinity }),
        comment({ timeInSeconds: 1 }),
        comment({ timeInSeconds: 10 }),
      ],
      { ...settings, curEpOffset: -2 },
    )!;
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].start).toBe(8);
  });
});
