export type PlayerEntryLayout = {
  preference?: string;
  width: number;
  height: number;
  flexibleWindow?: boolean;
};

/** Once shown, later rotations and episode changes must never hide the controls. */
export function resolvePlayerEntryVisibility(visible: boolean, layout: PlayerEntryLayout) {
  if (visible) return true;
  const { preference, width, height, flexibleWindow } = layout;
  if (width <= 0 || height <= 0) return false;
  if (flexibleWindow || preference === 'auto') return true;
  if (preference === 'portrait') return height > width;
  return width > height;
}
