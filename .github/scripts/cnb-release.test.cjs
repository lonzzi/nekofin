const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { createHash } = require('node:crypto');
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  assetNames,
  createClient,
  main,
  mirrorRelease,
  validateAssets,
  validateRepository,
  withMirrorNotes,
} = require('./cnb-release.cjs');

const repository = 'lonzzi/nekofin';
const tag = 'v0.2.0-beta.1';
const root = `https://api.cnb.cool/${repository}/-/releases`;
const source = {
  tagName: tag,
  name: tag,
  isDraft: false,
  isPrerelease: true,
  body: 'Release notes\n\n## Changes\n- Fix playback.',
  url: `https://github.com/lonzzi/nekofin/releases/tag/${tag}`,
};

function writeAssets(directory, releaseTag = tag) {
  const contents = new Map(
    assetNames(releaseTag)
      .slice(0, -1)
      .map((name) => [name, Buffer.from(`Installer or metadata: ${name}`)]),
  );
  const checksums =
    [...contents]
      .map(([name, content]) => `${createHash('sha256').update(content).digest('hex')}  ./${name}`)
      .join('\n') + '\n';
  contents.set('SHA256SUMS', Buffer.from(checksums));
  for (const [name, content] of contents) writeFileSync(path.join(directory, name), content);
  return contents;
}

function fixture(t, options = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-cnb-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const releaseTag = options.tag || tag;
  const contents = writeAssets(directory, releaseTag);
  const calls = [];
  const uploads = new Map();
  let state = options.state || 'missing';
  const release = () => ({
    id: 'release-id',
    tag_name: releaseTag,
    draft: state === 'draft',
    prerelease: releaseTag.includes('-'),
    assets: [...uploads].map(([name, content]) => ({ name, size: content.length })),
  });
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, ...init });
    if (url === `${root}/latest`) {
      return options.latest ? json({ tag_name: options.latest }) : json({}, 404);
    }
    if (url === `${root}/tags/${encodeURIComponent(releaseTag)}`) {
      if (options.apiFailure) return json({}, 403);
      return state === 'missing' ? json({}, 404) : json(release());
    }
    if (url === root && init.method === 'POST') {
      state = 'draft';
      if (options.ambiguousCreate) throw new TypeError('connection closed after creating release');
      return json(release(), 201);
    }
    if (url === `${root}/release-id/asset-upload-url`) {
      const { asset_name: name } = JSON.parse(init.body);
      return json(
        {
          upload_url: `https://storage.example/${name}?signature=private`,
          verify_url:
            options.badVerifyUrl || `${root}/release-id/asset-upload-confirmation/private/${name}`,
        },
        201,
      );
    }
    if (url.startsWith('https://storage.example/')) {
      assert.equal(init.headers.Authorization, undefined);
      if (options.failUpload) {
        init.body.destroy();
        return new Response('', { status: 500 });
      }
      const chunks = [];
      for await (const chunk of init.body) chunks.push(chunk);
      uploads.set(decodeURIComponent(new URL(url).pathname.slice(1)), Buffer.concat(chunks));
      return new Response('');
    }
    if (url.includes('/asset-upload-confirmation/')) return new Response('');
    if (url === `${root}/release-id` && init.method === 'GET') {
      const result = release();
      if (options.incomplete) result.assets.pop();
      return json(result);
    }
    if (url === `${root}/release-id` && init.method === 'PATCH') {
      state = 'published';
      return new Response('');
    }
    if (url.startsWith(`https://cnb.cool/${repository}/-/releases/download/`)) {
      assert.equal(init.headers?.Authorization, undefined);
      assert.equal(state, 'published');
      const name = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
      return new Response(options.badDownload ? 'corrupted' : contents.get(name));
    }
    throw new Error(`Unexpected test request: ${url}`);
  };
  return { directory, contents, calls, uploads, fetchImpl, releaseTag };
}

async function mirror(f, overrides = {}) {
  return mirrorRelease({
    repository,
    token: 'test-token',
    tag: f.releaseTag,
    source: { ...source, tagName: f.releaseTag, isPrerelease: f.releaseTag.includes('-') },
    commit: 'a'.repeat(40),
    assets: await validateAssets(f.directory, f.releaseTag),
    fetchImpl: f.fetchImpl,
    ...overrides,
  });
}

test('accepts nested CNB organizations and rejects URLs and unsafe paths', () => {
  assert.equal(validateRepository('lonzzi/apps/nekofin'), 'lonzzi/apps/nekofin');
  for (const value of [
    undefined,
    '',
    'nekofin',
    'https://cnb.cool/lonzzi/nekofin',
    'lonzzi/../nekofin',
    'lonzzi/./nekofin',
    'lonzzi/nekofin.git',
    'lonzzi/nekofin\n',
  ]) {
    assert.throws(() => validateRepository(value), /CNB_REPO/);
  }
});

test('requires complete installers and metadata with matching SHA-256 checksums', async (t) => {
  const f = fixture(t);
  assert.equal((await validateAssets(f.directory, tag)).length, 5);
  writeFileSync(path.join(f.directory, assetNames(tag)[0]), 'tampered installer');
  await assert.rejects(validateAssets(f.directory, tag), /checksum mismatch/);
});

test('rejects duplicate checksum entries and missing metadata', async (t) => {
  const f = fixture(t);
  const filename = path.join(f.directory, 'SHA256SUMS');
  const checksums = readFileSync(filename, 'utf8');
  writeFileSync(filename, checksums + checksums.split('\n')[0] + '\n');
  await assert.rejects(validateAssets(f.directory, tag), /duplicate/);
  writeFileSync(filename, checksums);
  rmSync(path.join(f.directory, assetNames(tag)[2]));
  await assert.rejects(validateAssets(f.directory, tag), /ENOENT/);
});

test('adds version-specific download links without losing or duplicating release notes', () => {
  const notes = withMirrorNotes(source.body, repository, tag);
  assert.ok(notes.startsWith(source.body));
  assert.ok(notes.includes(`https://cnb.cool/${repository}/-/releases/tag/${tag}`));
  assert.ok(notes.includes(`download/${tag}/nekofin-${tag}-android-arm64.apk`));
  assert.equal(withMirrorNotes(notes, repository, tag), notes);
  const updated = withMirrorNotes(notes + '\nA user edit.', 'lonzzi/new-mirror', tag);
  assert.ok(updated.includes('A user edit.'));
  assert.ok(!updated.includes(`https://cnb.cool/${repository}/`));
});

test('creates a draft, confirms all uploads, publishes a beta and verifies anonymous downloads', async (t) => {
  const f = fixture(t);
  assert.equal(await mirror(f), `https://cnb.cool/${repository}/-/releases/tag/${tag}`);
  const created = JSON.parse(f.calls.find((call) => call.url === root).body);
  assert.equal(created.draft, true);
  assert.equal(created.make_latest, 'false');
  assert.equal(created.target_commitish, 'a'.repeat(40));
  assert.equal(f.uploads.size, 5);
  for (const call of f.calls.filter((call) => call.url.endsWith('/asset-upload-url'))) {
    assert.equal(JSON.parse(call.body).ttl, 0);
  }
  assert.equal(
    f.calls.filter((call) => call.url.includes('/asset-upload-confirmation/')).length,
    5,
  );
  assert.deepEqual(JSON.parse(f.calls.find((call) => call.method === 'PATCH').body), {
    draft: false,
    prerelease: true,
    make_latest: 'false',
  });
});

test('publishes stable mirrors as Latest', async (t) => {
  const f = fixture(t, { tag: 'v0.2.0' });
  await mirror(f);
  assert.deepEqual(JSON.parse(f.calls.find((call) => call.method === 'PATCH').body), {
    draft: false,
    prerelease: false,
    make_latest: 'true',
  });
});

test('backfilling an older stable version preserves a newer Latest release', async (t) => {
  const f = fixture(t, { tag: 'v0.2.0', latest: 'v0.3.0' });
  await mirror(f);
  assert.equal(
    JSON.parse(f.calls.find((call) => call.method === 'PATCH').body).make_latest,
    'false',
  );
});

test('resumes drafts without recreating a CNB release', async (t) => {
  const f = fixture(t, { state: 'draft' });
  await mirror(f);
  assert.equal(
    f.calls.some((call) => call.url === root),
    false,
  );
  assert.equal(f.uploads.size, 5);
});

test('reconciles an accepted creation request after the response connection closes', async (t) => {
  const f = fixture(t, { ambiguousCreate: true });
  await mirror(f);
  assert.equal(f.calls.filter((call) => call.url === root).length, 1);
  assert.equal(f.uploads.size, 5);
});

test('retries temporary read failures without retrying permission errors', async () => {
  let calls = 0;
  const request = createClient('test-token', async () => {
    if (++calls === 1) throw new TypeError('temporary network failure');
    return new Response('{"id":"release-id"}');
  });
  assert.deepEqual(await request('GET', `${root}/tags/${tag}`), { id: 'release-id' });
  assert.equal(calls, 2);
});

test('checks published mirrors without replacing their assets or changing Latest', async (t) => {
  const f = fixture(t, { state: 'published' });
  await mirror(f);
  assert.equal(
    f.calls.some((call) => call.method === 'POST' || call.method === 'PATCH'),
    false,
  );
  assert.equal(f.calls.filter((call) => call.url.startsWith('https://cnb.cool/')).length, 5);
});

test('upload failures leave a draft unpublished and renew signed URLs on retry', async (t) => {
  const f = fixture(t, { failUpload: true });
  await assert.rejects(mirror(f), /upload failed after 3 attempts/);
  assert.equal(f.calls.filter((call) => call.url.endsWith('/asset-upload-url')).length, 3);
  assert.equal(
    f.calls.some((call) => call.method === 'PATCH'),
    false,
  );
});

test('does not publish when upload confirmation metadata is incomplete', async (t) => {
  const f = fixture(t, { incomplete: true });
  await assert.rejects(mirror(f), /missing or incomplete/);
  assert.equal(
    f.calls.some((call) => call.method === 'PATCH'),
    false,
  );
});

test('rejects a mirror whose public bytes differ from GitHub', async (t) => {
  const f = fixture(t, { state: 'published', badDownload: true });
  await assert.rejects(mirror(f), /public download verification failed/);
});

test('rejects cross-origin confirmation URLs before transmitting installers', async (t) => {
  const f = fixture(t, { badVerifyUrl: 'https://other.example/confirm' });
  await assert.rejects(mirror(f), /invalid asset upload URL/);
  assert.equal(
    f.calls.some((call) => call.method === 'PUT'),
    false,
  );
  const request = createClient('test-token', f.fetchImpl);
  await assert.rejects(request('POST', 'https://other.example/confirm'), /CNB API origin/);
});

test('permission errors and GitHub drafts never create a mirror', async (t) => {
  const f = fixture(t, { apiFailure: true });
  await assert.rejects(mirror(f), /HTTP 403/);
  assert.equal(f.calls.length, 1);
  await assert.rejects(mirror(f, { source: { ...source, isDraft: true } }), /Only published/);
  assert.equal(f.calls.length, 1);
});

test('updates GitHub notes only after mirroring succeeds and preserves concurrent edits', async (t) => {
  const f = fixture(t);
  const commands = [];
  let views = 0;
  let downloadedDirectory;
  const run = (command, args, options) => {
    commands.push({ command, args, options });
    if (command === 'gh' && args[1] === 'view')
      return JSON.stringify({
        ...source,
        body: source.body + (views++ ? '\nUser edit during upload.' : ''),
      });
    if (command === 'gh' && args[1] === 'download') {
      downloadedDirectory = args[args.indexOf('--dir') + 1];
      writeAssets(downloadedDirectory);
    }
    if (command === 'git' && args[0] === 'rev-parse') return 'a'.repeat(40);
    if (command === 'gh' && args[1] === 'edit') {
      const notes = readFileSync(args[args.indexOf('--notes-file') + 1], 'utf8');
      assert.ok(notes.includes('User edit during upload.'));
      assert.ok(notes.includes('CNB Release'));
      assert.equal(f.calls.at(-1).url.includes('SHA256SUMS'), true);
    }
    return '';
  };
  await main(
    { CNB_REPO: repository, CNB_TOKEN: 'test-token', RELEASE_TAG: tag },
    { run, fetchImpl: f.fetchImpl },
  );
  assert.equal(
    commands.filter((call) => call.command === 'gh' && call.args[1] === 'edit').length,
    1,
  );
  const push = commands.find((call) => call.command === 'git' && call.args[0] === 'push');
  assert.ok(push.args.includes(`refs/tags/${tag}:refs/tags/${tag}`));
  assert.ok(!push.args.includes('--force'));
  assert.ok(!push.args.join(' ').includes('test-token'));
  assert.equal(existsSync(downloadedDirectory), false);
});

test('never adds GitHub download links after a failed CNB upload', async (t) => {
  const f = fixture(t, { failUpload: true });
  const commands = [];
  const run = (command, args) => {
    commands.push({ command, args });
    if (command === 'gh' && args[1] === 'view') return JSON.stringify(source);
    if (command === 'gh' && args[1] === 'download') writeAssets(args[args.indexOf('--dir') + 1]);
    if (command === 'git' && args[0] === 'rev-parse') return 'a'.repeat(40);
    return '';
  };
  await assert.rejects(
    main(
      { CNB_REPO: repository, CNB_TOKEN: 'test-token', RELEASE_TAG: tag },
      { run, fetchImpl: f.fetchImpl },
    ),
    /upload failed/,
  );
  assert.equal(
    commands.some((call) => call.command === 'gh' && call.args[1] === 'edit'),
    false,
  );
});
