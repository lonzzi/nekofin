const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { getReleaseMetadata } = require('./release-metadata.cjs');

for (const [tag, prerelease] of [
  ['v0.2.0', false],
  ['v0.2.0-alpha.1', true],
  ['v0.2.0-beta.2', true],
  ['v0.2.0-rc.1', true],
  ['v0.2.0-preview', true],
  ['v0.2.0-0', true],
  ['v0.2.0+build.7', false],
  ['v0.2.0-rc.1+build.7', true],
]) {
  test(`classifies ${tag}`, () => {
    assert.deepEqual(getReleaseMetadata(tag, '0.2.0'), { tag, version: '0.2.0', prerelease });
  });
}

for (const tag of [
  'nightly',
  'main',
  '0.2.0',
  'v0.2',
  'v00.2.0',
  'v0.02.0',
  'v0.2.00',
  'v0.2.0-beta.01',
  'v0.2.0-',
  'v0.2.0-beta..1',
  'v0.2.0/foo',
  'v0.2.0\n',
]) {
  test(`rejects invalid tag ${JSON.stringify(tag)}`, () => {
    assert.throws(() => getReleaseMetadata(tag, '0.2.0'), /Invalid release tag/);
  });
}

test('rejects tags that disagree with the native app version', () => {
  assert.throws(() => getReleaseMetadata('v0.3.0-beta.1', '0.2.0'), /requires.*0\.3\.0/);
  assert.throws(() => getReleaseMetadata('v0.2.0-beta.1', '0.2.0-beta.1'), /requires.*0\.2\.0/);
});

test('writes validated metadata to GitHub outputs and rejects mismatched versions', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-version-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version: '0.2.0' }));
  const output = path.join(directory, 'output');
  const run = (tag) =>
    spawnSync(process.execPath, [require.resolve('./release-metadata.cjs'), tag], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    });

  const valid = run('v0.2.0-beta.1');
  assert.equal(valid.status, 0, valid.stderr);
  const expected = 'tag=v0.2.0-beta.1\nversion=0.2.0\nprerelease=true\n';
  assert.equal(readFileSync(output, 'utf8'), expected);

  const invalid = run('v0.3.0');
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /requires.*0\.3\.0/);
  assert.equal(readFileSync(output, 'utf8'), expected);
});

function publish(
  t,
  {
    tag = 'v0.2.0',
    prerelease = false,
    state = 'missing',
    failUpload = false,
    missingAsset = false,
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-release-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'release'));
  for (const name of [
    `nekofin-${tag}-android-arm64.apk`,
    `nekofin-${tag}-ios-unsigned.ipa`,
    'SHA256SUMS',
  ]) {
    if (!missingAsset || !name.endsWith('.ipa')) {
      writeFileSync(path.join(directory, 'release', name), 'test asset');
    }
  }

  const log = path.join(directory, 'gh-calls.jsonl');
  writeFileSync(log, '');
  // Exercise the actual publishing script without making GitHub API calls.
  writeFileSync(
    path.join(directory, 'gh'),
    `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.GH_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[1] === 'view') {
  if (process.env.GH_TEST_STATE === 'missing') process.exit(1);
  console.log(process.env.GH_TEST_STATE === 'draft' ? 'true' : 'false');
}
if (args[1] === 'upload' && process.env.GH_TEST_FAIL_UPLOAD === 'true') process.exit(1);
`,
    { mode: 0o755 },
  );

  const result = spawnSync('bash', [require.resolve('./publish-release.sh')], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH}`,
      RELEASE_TAG: tag,
      PRERELEASE: String(prerelease),
      GH_TEST_LOG: log,
      GH_TEST_STATE: state,
      GH_TEST_FAIL_UPLOAD: String(failUpload),
    },
  });
  const calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  return { ...result, calls };
}

test('publishes stable assets from a draft and marks the release as latest', (t) => {
  const result = publish(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call[1]),
    ['view', 'create', 'upload', 'edit'],
  );
  assert.ok(result.calls[1].includes('--draft'));
  assert.ok(result.calls[1].includes('--verify-tag'));
  assert.ok(result.calls[1].includes('--generate-notes'));
  assert.ok(result.calls[2].includes('release/nekofin-v0.2.0-android-arm64.apk'));
  assert.ok(result.calls[2].includes('release/nekofin-v0.2.0-ios-unsigned.ipa'));
  assert.ok(result.calls[2].includes('release/SHA256SUMS'));
  assert.ok(result.calls[3].includes('--draft=false'));
  assert.ok(result.calls[3].includes('--prerelease=false'));
  assert.ok(result.calls[3].includes('--latest=true'));
});

test('publishes a prerelease without replacing the latest stable release', (t) => {
  const result = publish(t, { tag: 'v0.2.0-beta.1', prerelease: true });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.calls[1].includes('--prerelease=true'));
  assert.ok(result.calls[3].includes('--prerelease=true'));
  assert.ok(result.calls[3].includes('--latest=false'));
});

test('resumes an existing draft after a failed run', (t) => {
  const result = publish(t, { state: 'draft' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call[1]),
    ['view', 'upload', 'edit'],
  );
});

test('keeps an already published release unchanged on reruns', (t) => {
  const result = publish(t, { state: 'published' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call[1]),
    ['view'],
  );
});

test('does not publish when an asset upload fails', (t) => {
  const result = publish(t, { failUpload: true });
  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.calls.map((call) => call[1]),
    ['view', 'create', 'upload'],
  );
});

test('rejects incomplete assets before creating a release', (t) => {
  const result = publish(t, { missingAsset: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing or empty release asset/);
  assert.deepEqual(result.calls, []);
});
