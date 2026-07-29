const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export type PlayerOverlayLayout = {
  side: number;
  topExtra: number;
  bottomExtra: number;
  isPortrait: boolean;
  isCompact: boolean;
  stackBottomControls: boolean;
  maxContentWidth: number;
};

export function derivePlayerOverlayLayout(width: number, height: number): PlayerOverlayLayout {
  const isPortrait = height >= width;
  const shortEdge = Math.min(width, height);
  const isCompact = shortEdge < 430;
  const side = isPortrait ? clamp(width * 0.045, 16, 28) : clamp(width * 0.045, 24, 64);

  return {
    side: Math.round(side),
    topExtra: isPortrait ? 10 : 0,
    bottomExtra: isPortrait ? 10 : 0,
    isPortrait,
    isCompact,
    stackBottomControls: isPortrait && width < 720,
    maxContentWidth: isPortrait ? 720 : 1080,
  };
}
