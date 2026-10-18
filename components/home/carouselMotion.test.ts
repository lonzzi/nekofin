import { describe, expect, it } from 'vitest';

import {
  getCarouselDragOffset,
  getCarouselPresentation,
  getCarouselSnapDuration,
  getCarouselSnapTarget,
  getMountedCarouselIndexes,
} from './carouselMotion';

const presentation = (
  index: number,
  current: number,
  target = -1,
  progress = 0,
  drag = 0,
  dragging = false,
  count = 6,
) => getCarouselPresentation(index, current, count, target, progress, drag, dragging, 400);

describe('carousel image continuity', () => {
  it('retains the destination view across forward, backward, and wraparound changes', () => {
    for (let current = 0; current < 6; current++) {
      for (const direction of [-1, 1]) {
        const target = (current + direction + 6) % 6;
        expect(getMountedCarouselIndexes(current, 6)).toContain(target);
        expect(getMountedCarouselIndexes(target, 6)).toContain(target);
      }
    }
  });

  it('bounds decoded views and handles empty, short, and replaced item lists', () => {
    expect(getMountedCarouselIndexes(0, 0)).toEqual([]);
    expect(getMountedCarouselIndexes(0, 1)).toEqual([0]);
    expect(getMountedCarouselIndexes(0, 2)).toEqual([0, 1]);
    expect(getMountedCarouselIndexes(5, 2)).toEqual([0, 1]);
    expect(getMountedCarouselIndexes(50, 100)).toHaveLength(3);
  });

  it('keeps an opaque source underneath every frame of an automatic fade', () => {
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      expect(presentation(0, 0, 1, progress).opacity).toBe(1);
      expect(presentation(1, 0, 1, progress).opacity).toBe(progress);
      expect(presentation(2, 0, 1, progress).opacity).toBe(0);
    }
  });

  it('keeps image and title visible when the shared index commits before React settles', () => {
    expect(presentation(1, 1, 1, 1)).toMatchObject({ opacity: 1, textOpacity: 1, offset: 0 });
    expect(presentation(0, 1, 1, 1).opacity).toBe(0);
    expect(presentation(1, 1)).toMatchObject({ opacity: 1, textOpacity: 1 });
  });

  it('reveals the correct neighbor in both directions, including a two-item carousel', () => {
    expect(presentation(1, 0, -1, 0, -200, true)).toMatchObject({
      opacity: 1,
      offset: 200,
      textOpacity: 0.5,
    });
    expect(presentation(5, 0, -1, 0, 200, true)).toMatchObject({
      opacity: 1,
      offset: -200,
      textOpacity: 0.5,
    });
    expect(presentation(1, 0, -1, 0, 200, true, 2).offset).toBe(-200);
    expect(presentation(1, 0, -1, 0, -200, true, 2).offset).toBe(200);
  });

  it('restores the current image and hides neighbors after a cancelled gesture or fade', () => {
    expect(presentation(0, 0)).toMatchObject({ opacity: 1, textOpacity: 1, textOffset: 0 });
    expect(presentation(1, 0)).toMatchObject({ opacity: 0, textOpacity: 0 });
    expect(presentation(5, 0)).toMatchObject({ opacity: 0, textOpacity: 0 });
  });
});

describe('interrupted carousel gestures', () => {
  it('uses the released position when the final move was coalesced', () => {
    const lastRenderedOffset = getCarouselDragOffset(0, 30, 400);
    const releasedOffset = getCarouselDragOffset(0, 300, 400);
    expect(getCarouselSnapTarget(lastRenderedOffset, 0, 400)).toBe(0);
    expect(getCarouselSnapTarget(releasedOffset, 0, 400)).toBe(400);
    expect(getCarouselSnapDuration(releasedOffset, 400, 400)).toBe(60);
  });

  it.each([-1, 1])('continues a reveal from its visible position in direction %i', (direction) => {
    const interruptedOffset = direction * 260;
    const resumedOffset = getCarouselDragOffset(interruptedOffset, direction * 20, 400);
    const target = direction < 0 ? 1 : 5;
    const before = presentation(target, 0, -1, 0, interruptedOffset, true);
    const after = presentation(target, 0, -1, 0, resumedOffset, true);
    expect(after.offset - before.offset).toBe(direction * 20);
    expect(after.textOpacity).toBeGreaterThan(before.textOpacity);
  });

  it.each([-1, 1])(
    'finishes an interrupted reveal without another animation in direction %i',
    (direction) => {
      const drag = getCarouselDragOffset(direction * 330, direction * 150, 400);
      const target = getCarouselSnapTarget(drag, direction * 900, 400);
      expect(drag).toBe(direction * 400);
      expect(target).toBe(drag);
      expect(getCarouselSnapDuration(drag, target, 400)).toBe(0);
    },
  );

  it('shortens the remaining animation instead of restarting the full settle time', () => {
    expect(getCarouselSnapDuration(0, 400, 400)).toBe(240);
    expect(getCarouselSnapDuration(300, 400, 400)).toBe(60);
    expect(getCarouselSnapDuration(-300, -400, 400)).toBe(60);
  });

  it.each([-1, 1])(
    'lets a fast reverse swipe change direction from a partial reveal %i',
    (direction) => {
      const drag = getCarouselDragOffset(direction * 300, direction * -100, 400);
      expect(getCarouselSnapTarget(drag, direction * -900, 400)).toBe(direction * -400);
      expect(getCarouselSnapDuration(drag, direction * -400, 400)).toBe(240);
    },
  );

  it('returns a small released drag to the current image', () => {
    expect(getCarouselSnapTarget(60, 100, 400)).toBe(0);
    expect(getCarouselSnapTarget(-60, -100, 400)).toBe(0);
    expect(getCarouselSnapDuration(60, 0, 400)).toBe(180);
  });
});
