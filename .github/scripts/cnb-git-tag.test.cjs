const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { syncGitTag } = require('./cnb-release.cjs');

const repository = 'lonzzi/nekofin';
const tag = 'v0.2.0-beta.1';
const tagRef = `refs/tags/${tag}`;

function git(directory, ...args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function fixture(t, { annotated = true } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-cnb-tag-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const origin = path.join(directory, 'origin.git');
  const mirror = path.join(directory, 'cnb.git');
  const seed = path.join(directory, 'seed');
  const worker = path.join(directory, 'worker');
  git(directory, 'init', '--bare', '--initial-branch=main', origin);
  git(directory, 'init', '--bare', '--initial-branch=main', mirror);
  git(directory, 'init', '--initial-branch=main', seed);
  writeFileSync(path.join(seed, 'app.txt'), 'release source\n');
  git(seed, 'add', 'app.txt');
  const identity = ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid'];
  git(seed, ...identity, '-c', 'commit.gpgsign=false', 'commit', '-m', 'feat: prepare release');
  git(
    seed,
    ...identity,
    '-c',
    'tag.gpgsign=false',
    'tag',
    ...(annotated ? ['-a', tag, '-m', 'Release'] : [tag]),
  );
  git(seed, 'push', origin, 'main', tagRef);
  git(directory, 'clone', origin, worker);
  const commit = git(worker, 'rev-parse', `${tagRef}^{commit}`);
  const tagObject = git(origin, 'rev-parse', tagRef);
  // Reproduce checkout's +<github.sha>:refs/tags/<tag> fetch in a tag-triggered run.
  git(worker, 'update-ref', tagRef, commit);
  const sync = () =>
    syncGitTag(repository, 'test-token', tag, {
      run(command, args, options) {
        assert.equal(command, 'git');
        if (args[0] === 'push') {
          assert.deepEqual(args, [
            'push',
            `https://cnb.cool/${repository}.git`,
            `${tagRef}:${tagRef}`,
          ]);
          return execFileSync('git', ['push', mirror, ...args.slice(2)], {
            ...options,
            cwd: worker,
          });
        }
        return execFileSync(command, args, { ...options, cwd: worker });
      },
    });
  return { origin, mirror, worker, commit, tagObject, sync };
}

test('restores an annotated GitHub tag after checkout and mirrors its tag object on reruns', (t) => {
  const f = fixture(t);
  assert.equal(git(f.worker, 'rev-parse', tagRef), f.commit);
  assert.notEqual(f.tagObject, f.commit);

  assert.equal(f.sync(), f.commit);
  assert.equal(git(f.worker, 'cat-file', '-t', tagRef), 'tag');
  assert.equal(git(f.mirror, 'rev-parse', tagRef), f.tagObject);
  assert.equal(git(f.mirror, 'rev-parse', `${tagRef}^{commit}`), f.commit);

  assert.equal(f.sync(), f.commit);
  assert.equal(git(f.mirror, 'rev-parse', tagRef), f.tagObject);
  assert.equal(git(f.origin, 'rev-parse', tagRef), f.tagObject);
});

test('mirrors lightweight GitHub tags when the local tag is missing', (t) => {
  const f = fixture(t, { annotated: false });
  git(f.worker, 'update-ref', '-d', tagRef);

  assert.equal(f.sync(), f.commit);
  assert.equal(git(f.mirror, 'cat-file', '-t', tagRef), 'commit');
  assert.equal(git(f.mirror, 'rev-parse', tagRef), f.tagObject);
});

test('rejects an existing CNB tag conflict without replacing either published tag', (t) => {
  const f = fixture(t);
  git(f.worker, 'push', f.mirror, `${f.commit}:${tagRef}`);

  assert.throws(f.sync, /Could not push the release tag to CNB/);
  assert.equal(git(f.mirror, 'rev-parse', tagRef), f.commit);
  assert.equal(git(f.origin, 'rev-parse', tagRef), f.tagObject);
});
