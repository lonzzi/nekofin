import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { AndroidToolbarDrawable } from './nativeHeaderModel';

const ANDROID_TOOLBAR_ASSET_FILES = {
  add: 'add.xml',
  checkmarkCircle: 'checkmark_circle.xml',
  checkmarkCircleOutline: 'checkmark_circle_outline.xml',
  film: 'film.xml',
  heart: 'heart.xml',
  heartOutline: 'heart_outline.xml',
  person: 'person.xml',
  save: 'save.xml',
  search: 'search.xml',
} as const satisfies Record<AndroidToolbarDrawable, string>;

describe('native Android toolbar assets', () => {
  it('uses Android-compatible resource names', () => {
    const drawableDirectory = fileURLToPath(new URL('../../assets/drawables', import.meta.url));

    for (const fileName of readdirSync(drawableDirectory)) {
      expect(fileName).toMatch(/^[a-z0-9_]+\.(png|xml)$/);
    }
  });

  it.each(Object.entries(ANDROID_TOOLBAR_ASSET_FILES))(
    'ships a native vector for %s',
    (_key, fileName) => {
      const path = fileURLToPath(new URL(`../../assets/drawables/${fileName}`, import.meta.url));
      expect(readFileSync(path, 'utf8')).toMatch(/<vector\b/);
    },
  );

  const drawableDirectory = fileURLToPath(new URL('../../assets/drawables', import.meta.url));
  it.each(readdirSync(drawableDirectory).filter((name) => name.endsWith('.xml')))(
    '%s supports both Android and Compose icon rendering',
    (fileName) => {
      const xml = readFileSync(`${drawableDirectory}/${fileName}`, 'utf8');
      expect(xml).toMatch(/<vector\b/);
      expect(xml).toMatch(/android:viewportWidth="[1-9]\d*(?:\.\d+)?"/);
      expect(xml).toMatch(/android:viewportHeight="[1-9]\d*(?:\.\d+)?"/);

      // Expo's Compose loader supports filled paths, not strokes, groups or gradients.
      expect(xml).not.toMatch(/<(?:group|clip-path|gradient|aapt:attr)\b/);
      expect(xml).not.toMatch(/android:stroke\w*=/);
      const paths = [...xml.matchAll(/<path\b[^>]*\/>/g)];
      expect(paths.length).toBeGreaterThan(0);
      for (const [path] of paths) {
        expect(path).toMatch(/android:fillColor="#[\da-fA-F]{6}(?:[\da-fA-F]{2})?"/);
        expect(path).toMatch(/android:pathData="[^"]+"/);
      }
    },
  );
});
