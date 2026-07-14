import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    if (!['.ts', '.tsx'].includes(extname(entry.name)) || entry.name.includes('.test.')) return [];
    return [path];
  });
}

describe('custom Liquid Glass policy', () => {
  it('keeps Expo GlassContainer access behind SafeGlassContainer', () => {
    const sourceFiles = [join(repositoryRoot, 'app'), join(repositoryRoot, 'components')].flatMap(
      collectSourceFiles,
    );
    const directImports = sourceFiles
      .filter((path) => !path.endsWith('/components/ui/GlassCard.tsx'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return (
          source.includes("from 'expo-glass-effect'") &&
          /import\s*\{[^}]*\bGlassContainer\b[^}]*\}/s.test(source)
        );
      })
      .map((path) => path.slice(repositoryRoot.length + 1));

    expect(directImports).toEqual([]);
  });

  it('keeps Liquid Glass opt-in limited to intentional surfaces', () => {
    const cardSource = readFileSync(join(repositoryRoot, 'components/ui/GlassCard.tsx'), 'utf8');
    const detailSource = readFileSync(
      join(repositoryRoot, 'components/detail-view/common.tsx'),
      'utf8',
    );
    const serversSource = readFileSync(
      join(repositoryRoot, 'app/(tabs)/(servers)/index.tsx'),
      'utf8',
    );

    expect(cardSource).toContain('useGlassEffect = false');
    expect(detailSource).toContain('isLiquidGlassAvailable() && isGlassEffectAPIAvailable()');
    expect(detailSource).toContain('useGlassEffect');
    expect(serversSource).toContain('useGlassEffect');
  });

  it('fills information cards while media cards opt into transparent copy areas', () => {
    const cardSource = readFileSync(join(repositoryRoot, 'components/ui/GlassCard.tsx'), 'utf8');
    const transparentMediaSources = [
      'components/media/Card.tsx',
      'components/detail-view/PersonItem.tsx',
      'components/user-view/UserViewCard.tsx',
      'components/ui/Skeleton.tsx',
    ];

    expect(cardSource).toContain("surface = 'solid'");
    expect(cardSource).toContain('fallbackBackgroundColor ?? theme.colors.surface');
    expect(cardSource).toContain("surface === 'material'");

    for (const relativePath of transparentMediaSources) {
      const source = readFileSync(join(repositoryRoot, relativePath), 'utf8');
      expect(source).toContain('surface="transparent"');
    }
  });
});
