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

describe('native header migration', () => {
  it('does not imperatively register application header content', () => {
    const sourceFiles = [join(repositoryRoot, 'app'), join(repositoryRoot, 'components')].flatMap(
      collectSourceFiles,
    );
    const forbiddenPatterns = ['navigation.' + 'setOptions(', 'header' + 'Right:'];
    const matches = sourceFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return forbiddenPatterns
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${path.slice(repositoryRoot.length + 1)}: ${pattern}`);
    });

    expect(matches).toEqual([]);
  });

  it('keeps dynamic server titles overridable by Stack.Title', () => {
    const serverLayout = readFileSync(
      join(repositoryRoot, 'app/(tabs)/(servers)/_layout.tsx'),
      'utf8',
    );

    expect(serverLayout).not.toContain("headerTitle: '添加服务器'");
    expect(serverLayout).not.toContain("headerTitle: '服务器配置'");
  });
});
