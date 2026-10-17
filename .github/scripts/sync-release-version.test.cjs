const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = require.resolve('./sync-release-version.cjs');
const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();

function git(directory, ...args) {
  return execFileSync(realGit, args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commit(directory, message) {
  git(directory, 'add', '.');
  git(
    directory,
    '-c',
    'user.name=Release Test',
    '-c',
    'user.email=release@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    message,
  );
}

function fixture(t, { mainVersion = '0.1.0', offMain = false, annotated = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-version-sync-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const remote = path.join(directory, 'remote.git');
  const seed = path.join(directory, 'seed');
  git(directory, 'init', '--bare', '--initial-branch=main', remote);
  git(directory, 'init', '--initial-branch=main', seed);
  const appPackage = { name: 'nekofin', version: '0.1.0', dependencies: { expo: '~57.0.28' } };
  writeFileSync(path.join(seed, 'package.json'), JSON.stringify(appPackage, null, 2) + '\n');
  writeFileSync(path.join(seed, 'application.txt'), 'merged application code');
  commit(seed, 'feat: prepare release');
  if (offMain) {
    git(seed, 'checkout', '-b', 'feature');
    writeFileSync(path.join(seed, 'feature.txt'), 'unmerged code');
    commit(seed, 'feat: unmerged release');
  }
  const tag = 'v0.2.0-beta.1';
  if (annotated) {
    git(
      seed,
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=release@example.invalid',
      'tag',
      '-a',
      tag,
      '-m',
      'Release',
    );
  } else {
    git(seed, 'tag', tag);
  }
  const sha = git(seed, 'rev-parse', `${tag}^{commit}`);
  if (offMain) git(seed, 'checkout', 'main');
  if (mainVersion !== '0.1.0') {
    writeFileSync(
      path.join(seed, 'package.json'),
      JSON.stringify({ ...appPackage, version: mainVersion }, null, 2) + '\n',
    );
    commit(seed, 'chore: update development version');
  }
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', 'origin', 'main', `refs/tags/${tag}`);
  const worker = path.join(directory, 'worker');
  git(directory, 'clone', remote, worker);
  const run = (env = {}, releasedSha = sha) =>
    spawnSync(process.execPath, [script, tag, releasedSha], {
      cwd: worker,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  return { directory, remote, seed, worker, tag, sha, run };
}

test('syncs a successful tag release to main and preserves the original tag and source', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const appPackage = JSON.parse(git(f.remote, 'show', 'main:package.json'));
  assert.equal(appPackage.version, '0.2.0');
  assert.deepEqual(appPackage.dependencies, { expo: '~57.0.28' });
  assert.equal(git(f.remote, 'show', 'main:application.txt'), 'merged application code');
  assert.equal(
    git(f.remote, 'log', '-1', '--format=%s', 'main'),
    'chore(release): sync version to 0.2.0',
  );
  assert.equal(git(f.remote, 'rev-parse', f.tag), f.sha);
  assert.equal(JSON.parse(git(f.remote, 'show', `${f.tag}:package.json`)).version, '0.1.0');
  const updated = git(f.remote, 'rev-parse', 'main');
  assert.equal(f.run().status, 0);
  assert.equal(git(f.remote, 'rev-parse', 'main'), updated);
});

test('does not downgrade newer main versions or add commits for an unchanged base version', (t) => {
  for (const mainVersion of ['0.2.0', '0.3.0', '0.10.0']) {
    const f = fixture(t, { mainVersion });
    const before = git(f.remote, 'rev-parse', 'main');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(git(f.remote, 'rev-parse', 'main'), before);
  }
});

test('accepts annotated tags without moving their tag objects', (t) => {
  const f = fixture(t, { annotated: true });
  const originalTag = git(f.remote, 'rev-parse', f.tag);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(git(f.remote, 'show', 'main:package.json')).version, '0.2.0');
  assert.equal(git(f.remote, 'rev-parse', f.tag), originalTag);
  assert.equal(git(f.remote, 'rev-parse', `${f.tag}^{commit}`), f.sha);
});

test('does not sync an unmerged tag into main', (t) => {
  const f = fixture(t, { offMain: true });
  const before = git(f.remote, 'rev-parse', 'main');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /not part of main/);
  assert.equal(git(f.remote, 'rev-parse', 'main'), before);
});

test('refuses a moved tag and a dirty checkout before changing files', (t) => {
  const f = fixture(t);
  const before = git(f.remote, 'rev-parse', 'main');
  const moved = f.run({}, '0'.repeat(40));
  assert.notEqual(moved.status, 0);
  assert.match(moved.stderr, /tag moved/);
  writeFileSync(path.join(f.worker, 'local-work.txt'), 'keep local work');
  const dirty = f.run();
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr, /clean checkout/);
  assert.equal(readFileSync(path.join(f.worker, 'local-work.txt'), 'utf8'), 'keep local work');
  assert.equal(git(f.remote, 'rev-parse', 'main'), before);
});

test('retries a concurrent main push and preserves the newly merged code', (t) => {
  const f = fixture(t);
  const writer = path.join(f.directory, 'writer');
  git(f.directory, 'clone', f.remote, writer);
  const shim = path.join(f.directory, 'bin');
  mkdirSync(shim);
  const marker = path.join(f.directory, 'raced');
  writeFileSync(
    path.join(shim, 'git'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const args = process.argv.slice(2);
if(args[0] === 'push' && !fs.existsSync(process.env.RACE_MARKER)) {
 fs.writeFileSync(process.env.RACE_MARKER,'1');
 const cwd = process.env.RACE_WRITER;
 fs.writeFileSync(path.join(cwd,'newly-merged.txt'),'preserve the concurrent PR');
 for(const command of [
  ['add','.'],
  ['-c','user.name=Release Test','-c','user.email=release@example.invalid','-c','commit.gpgsign=false','commit','-m','feat: merge while release is building'],
  ['push','origin','main']
 ]) {
  const result=spawnSync(process.env.REAL_GIT,command,{cwd,encoding:'utf8'});
  if(result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
 }
}
const result=spawnSync(process.env.REAL_GIT,args,{stdio:'inherit'});
process.exit(result.status ?? 1);
`,
    { mode: 0o755 },
  );
  const result = f.run({
    PATH: `${shim}${path.delimiter}${process.env.PATH}`,
    REAL_GIT: realGit,
    RACE_WRITER: writer,
    RACE_MARKER: marker,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(git(f.remote, 'show', 'main:package.json')).version, '0.2.0');
  assert.equal(git(f.remote, 'show', 'main:newly-merged.txt'), 'preserve the concurrent PR');
  assert.equal(git(f.remote, 'rev-parse', f.tag), f.sha);
});

test('reports a rejected push without claiming main was synchronized', (t) => {
  const f = fixture(t);
  const before = git(f.remote, 'rev-parse', 'main');
  const shim = path.join(f.directory, 'bin');
  mkdirSync(shim);
  writeFileSync(
    path.join(shim, 'git'),
    `#!/usr/bin/env node
const {spawnSync}=require('node:child_process');
if(process.argv[2]==='push') { process.stderr.write('Push rejected by repository rules'); process.exit(1); }
const result=spawnSync(process.env.REAL_GIT,process.argv.slice(2),{stdio:'inherit'});
process.exit(result.status ?? 1);
`,
    { mode: 0o755 },
  );
  const result = f.run({ PATH: `${shim}${path.delimiter}${process.env.PATH}`, REAL_GIT: realGit });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rejected by repository rules/);
  assert.equal(git(f.remote, 'rev-parse', 'main'), before);
});
