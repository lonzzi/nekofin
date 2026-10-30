const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  changeFromCommit,
  generateNotes,
  previousRelease,
  renderNotes,
  replaceNotes,
} = require('./release-notes.cjs');
const { withMirrorNotes } = require('./cnb-release.cjs');

const sha = 'a'.repeat(40);
const tag = 'v0.1.0-beta.8';

test('compares published native versions by SemVer and ancestry, excluding drafts and catalogs', () => {
  const releases = [
    'v0.1.0-beta.7',
    'v0.1.0-beta.6',
    'v0.1.0-beta.10',
    'app-sources',
    'v0.1.0',
    'v0.0.9',
  ].map((tag_name) => ({ tag_name }));
  assert.equal(previousRelease(tag, releases), 'v0.1.0-beta.7');
  assert.equal(
    previousRelease(tag, releases, (candidate) => candidate !== 'v0.1.0-beta.7'),
    'v0.1.0-beta.6',
  );
  assert.equal(previousRelease(tag, [{ tag_name: 'v0.1.0-beta.7', draft: true }]), null);
});

test('honors explicit bilingual release trailers, groups conventional commits and skips version bookkeeping', () => {
  assert.equal(changeFromCommit(sha, 'chore(release): sync version to 0.1.0'), null);
  const change = changeFromCommit(
    sha,
    'fix(player): stabilize subtitle loading (#41)',
    'Release-Note-ZH: 修复字幕加载卡顿\nRelease-Note-EN: Fix subtitle loading stalls',
  );
  assert.equal(change.zh, '修复字幕加载卡顿');
  assert.equal(change.en, 'Fix subtitle loading stalls');
  assert.equal(change.group, 'fix');
  assert.equal(change.url, 'https://github.com/lonzzi/nekofin/pull/41');
  assert.equal(changeFromCommit(sha, 'feat: 添加更新源').en, undefined);
});

test('requires real bilingual entries and preserves manual notes plus verified CNB download links on reruns', () => {
  const change = changeFromCommit(sha, 'feat: Add update sources', 'Release-Note-ZH: 添加更新源');
  const notes = renderNotes(tag, 'v0.1.0-beta.7', [change]);
  assert.match(notes, /## 中文[\s\S]*添加更新源[\s\S]*## English[\s\S]*Add update sources/);
  assert.match(notes, /compare\/v0.1.0-beta.7\.\.\.v0.1.0-beta.8/);
  assert.throws(
    () => renderNotes(tag, null, [{ ...change, zh: 'Add update sources' }]),
    /Chinese and English/,
  );
  const original = withMirrorNotes('Manual release instructions.', 'lonzzi/nekofin', tag);
  const updated = replaceNotes(original, notes);
  assert.ok(updated.includes('Manual release instructions.'));
  assert.ok(updated.includes('CNB Release'));
  assert.equal(replaceNotes(updated, notes), updated);
  assert.equal((updated.match(/nekofin:cnb-downloads:start/g) || []).length, 1);
});

test('generates the selected tag range and never edits releases if translation fails', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-release-notes-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const commands = [];
  let failTranslation = false;
  const run = (command, args, options) => {
    commands.push([command, args]);
    if (command === 'gh' && args[0] === 'api')
      return JSON.stringify([[{ tag_name: 'v0.1.0-beta.7' }]]);
    if (command === 'git' && args[0] === 'log') {
      assert.equal(args.at(-1), 'v0.1.0-beta.7..v0.1.0-beta.8');
      return `${sha}\n`;
    }
    if (command === 'git') return 'feat: Add update sources (#42)\n';
    if (command === 'python3') {
      if (failTranslation) throw new Error('Translator unavailable');
      assert.equal(JSON.parse(options.input)[0].sha, sha);
      return JSON.stringify([{ sha, zh: '添加更新源', en: 'Add update sources' }]);
    }
    throw new Error(`Unexpected command: ${command}`);
  };
  const file = path.join(directory, 'notes.md');
  await generateNotes(tag, file, { run, isAncestor: () => true });
  assert.match(readFileSync(file, 'utf8'), /添加更新源/);
  failTranslation = true;
  await assert.rejects(
    generateNotes(tag, file, { run, publish: true, isAncestor: () => true }),
    /Translator unavailable/,
  );
  assert.ok(!commands.some(([command, args]) => command === 'gh' && args[0] === 'release'));
});
