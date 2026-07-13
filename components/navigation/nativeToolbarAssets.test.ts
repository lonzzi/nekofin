import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { AndroidToolbarDrawable } from './nativeHeaderModel';

const ANDROID_TOOLBAR_ASSET_FILES = {
  add: 'add.png',
  checkmarkCircle: 'checkmark_circle.png',
  checkmarkCircleOutline: 'checkmark_circle_outline.png',
  film: 'film.png',
  heart: 'heart.png',
  heartOutline: 'heart_outline.png',
  save: 'save.png',
  search: 'search.png',
} as const satisfies Record<AndroidToolbarDrawable, string>;

describe('native Android toolbar assets', () => {
  it('uses Android-compatible resource names', () => {
    const drawableDirectory = fileURLToPath(new URL('../../assets/drawables', import.meta.url));

    for (const fileName of readdirSync(drawableDirectory)) {
      expect(fileName).toMatch(/^[a-z0-9_]+\.(png|xml)$/);
    }
  });

  it.each(Object.entries(ANDROID_TOOLBAR_ASSET_FILES))(
    'ships a 256px PNG for %s',
    (_key, fileName) => {
      const path = fileURLToPath(new URL(`../../assets/drawables/${fileName}`, import.meta.url));
      const png = readFileSync(path);

      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(png.readUInt32BE(16)).toBe(256);
      expect(png.readUInt32BE(20)).toBe(256);
    },
  );
});
