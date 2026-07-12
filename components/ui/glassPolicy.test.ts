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

  it('uses both Expo availability checks for the detail play fallback', () => {
    const source = readFileSync(join(repositoryRoot, 'components/detail-view/common.tsx'), 'utf8');

    expect(source).toContain('isLiquidGlassAvailable() && isGlassEffectAPIAvailable()');
  });
});
