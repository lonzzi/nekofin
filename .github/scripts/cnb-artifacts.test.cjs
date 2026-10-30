const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { publishArtifacts } = require('./cnb-artifacts.cjs');

function fixture(t, { tag = 'ota-123', published = false, failPublic = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-cnb-artifacts-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const files = ['catalog-backup.json', 'catalog.json'].map((name) => path.join(directory, name));
  files.forEach((file) => writeFileSync(file, '{}\n'));
  const uploads = new Map();
  const calls = [];
  const api = 'https://api.cnb.cool/lonzzi/nekofin/-/releases';
  const release = () => ({
    id: 'id',
    tag_name: tag,
    draft: !published,
    assets: [...uploads].map(([name, bytes]) => ({ name, size: bytes.length })),
  });
  const json = (body) => new Response(JSON.stringify(body));
  const fetchImpl = async (url, options = {}) => {
    calls.push([url, options.method]);
    if (url === `${api}/tags/${tag}` || (url === `${api}/id` && options.method === 'GET'))
      return json(release());
    if (url === `${api}/id/asset-upload-url`) {
      const name = JSON.parse(options.body).asset_name;
      return json({
        upload_url: `https://storage.example/${name}`,
        verify_url: `${api}/id/asset-upload-confirmation/${name}`,
      });
    }
    if (url.startsWith('https://storage.example/')) {
      const bytes = [];
      for await (const chunk of options.body) bytes.push(chunk);
      uploads.set(new URL(url).pathname.slice(1), Buffer.concat(bytes));
      return new Response('');
    }
    if (url.includes('/asset-upload-confirmation/')) return new Response('');
    if (url === `${api}/id` && options.method === 'PATCH') {
      published = true;
      return new Response('');
    }
    if (url.startsWith('https://cnb.cool/')) {
      assert.equal(published, true);
      assert.equal(options.headers?.Authorization, undefined);
      return new Response(failPublic ? 'corrupt' : '{}\n');
    }
    throw new Error(`Unexpected request ${url}`);
  };
  return {
    files,
    calls,
    uploads,
    options: {
      repository: 'lonzzi/nekofin',
      token: 'test-token',
      tag,
      commit: 'a'.repeat(40),
      files,
      fetchImpl,
    },
  };
}

test('immutable resource reruns verify public bytes without replacing published attachments', async (t) => {
  const f = fixture(t, { published: true });
  await publishArtifacts(f.options);
  assert.equal(f.uploads.size, 0);
  assert.ok(f.calls.every(([, method]) => method === 'GET' || method === undefined));
});

test('only explicit pointer catalogs may be updated, in backup-before-current order', async (t) => {
  const f = fixture(t, { published: true, tag: 'ota-catalog' });
  await publishArtifacts({ ...f.options, mutable: true });
  assert.deepEqual([...f.uploads.keys()], ['catalog-backup.json', 'catalog.json']);
  assert.equal(
    f.calls.some(([, method]) => method === 'PATCH'),
    false,
  );
  await assert.rejects(
    publishArtifacts({ ...f.options, tag: 'ota-123', mutable: true }),
    /Only pointer catalogs/,
  );
});

test('draft artifacts publish only after upload confirmation and fail if anonymous bytes differ', async (t) => {
  const f = fixture(t);
  await publishArtifacts(f.options);
  const confirmation = f.calls.findLastIndex(([url]) =>
    url.includes('/asset-upload-confirmation/'),
  );
  const publication = f.calls.findIndex(([, method]) => method === 'PATCH');
  assert.ok(publication > confirmation);
  const bad = fixture(t, { published: true, failPublic: true });
  await assert.rejects(publishArtifacts(bad.options), /public download verification failed/);
});
