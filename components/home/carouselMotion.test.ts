import { describe, expect, it } from 'vitest';

import { getCarouselPresentation, getMountedCarouselIndexes } from './carouselMotion';

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
