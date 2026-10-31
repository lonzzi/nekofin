import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

import { navigationDestinations } from './navigationDestinations';

const root = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

it('routes every explicit app-root entry through the shared navigation action', () => {
  const roots = new Set<string>(['/', ...navigationDestinations.map((entry) => entry.href)]);
  const directRootCalls: string[] = [];
  for (const path of [
    ...sourceFiles(join(root, 'app')),
    ...sourceFiles(join(root, 'components')),
  ]) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const report = (node: ts.Node) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      directRootCalls.push(`${relative(root, path)}:${line}`);
    };
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ['push', 'navigate', 'replace', 'dismissTo'].includes(node.expression.name.text)
      ) {
        let argument = node.arguments[0];
        if (argument && ts.isObjectLiteralExpression(argument)) {
          const pathname = argument.properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
              property.name.text === 'pathname',
          );
          if (pathname && ts.isPropertyAssignment(pathname)) argument = pathname.initializer;
        }
        if (argument && ts.isStringLiteralLike(argument) && roots.has(argument.text)) report(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(directRootCalls).toEqual([]);
});
