export const CAROUSEL_FADE_MS = 650;

/** The same keyed slide survives preloading, the transition, and becoming current. */
export function getMountedCarouselIndexes(current: number, count: number) {
  if (!count) return [];
  current = ((current % count) + count) % count;
  return [...new Set([current, (current + 1) % count, (current - 1 + count) % count])].sort(
    (a, b) => a - b,
  );
}

export function getCarouselPresentation(
  index: number,
  current: number,
  count: number,
  autoTarget: number,
  autoProgress: number,
  drag: number,
  dragging: boolean,
  width: number,
) {
  'worklet';
  const fade = autoTarget >= 0 && autoTarget !== current ? autoProgress : 0;
  const progress = dragging ? Math.min(Math.abs(drag) / width, 1) : 0;
  if (index === current) {
    return {
      opacity: 1,
      offset: 0,
      order: 0,
      textOpacity: (1 - progress) * (1 - fade),
      textOffset: dragging ? drag : 0,
    };
  }
  const direction = drag < 0 ? 1 : -1;
  if (dragging && drag !== 0 && index === (current + direction + count) % count) {
    const offset = direction * width + drag;
    return { opacity: 1, offset, order: 1, textOpacity: progress, textOffset: offset };
  }
  if (index === autoTarget) {
    return { opacity: autoProgress, offset: 0, order: 1, textOpacity: autoProgress, textOffset: 0 };
  }
  return { opacity: 0, offset: 0, order: 0, textOpacity: 0, textOffset: 0 };
}
