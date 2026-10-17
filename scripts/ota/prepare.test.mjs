import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { validateEntry } from '../../updates/server/lib/protocol.mjs';
import { prepareRollback, prepareUpdate } from './prepare.mjs';

const { privateKey, publicKey: certificate } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const channel = 'production-v0.1.0-beta.1';
const runtimeVersion = 'a'.repeat(40);
const nativeRuntimes = {
  channel,
  url: 'https://test/api/manifest',
  runtimes: { ios: runtimeVersion, android: 'b'.repeat(40) },
};

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-ota-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const exportDir = path.join(directory, 'export');
  mkdirSync(path.join(exportDir, 'assets'), { recursive: true });
  writeFileSync(path.join(exportDir, 'bundle.hbc'), 'test bundle bytes');
  writeFileSync(path.join(exportDir, 'assets', 'packager-hash'), 'test image bytes');
  const files = { bundle: 'bundle.hbc', assets: [{ path: 'assets/packager-hash', ext: 'png' }] };
  writeFileSync(
    path.join(exportDir, 'metadata.json'),
    JSON.stringify({ fileMetadata: { ios: files, android: files } }),
  );
  return {
    exportDir,
    outputDir: path.join(directory, 'output'),
    config: {
      updates: { url: nativeRuntimes.url, requestHeaders: { 'expo-channel-name': channel } },
    },
    nativeRuntimes,
    tag: 'ota-test-123',
    privateKey,
    certificate,
  };
}

test('exports both platforms with signed manifests, correct asset keys and content hashes', (t) => {
  const options = fixture(t);
  const { entries } = prepareUpdate(options);
  for (const platform of ['ios', 'android']) {
    const runtimeVersion = nativeRuntimes.runtimes[platform];
    const entry = entries[`${channel}/${platform}/${runtimeVersion}`];
    const manifest = validateEntry(entry, { channel, platform, runtimeVersion, certificate });
    assert.equal(manifest.assets[0].key, 'packager-hash');
    assert.equal(manifest.assets[0].fileExtension, '.png');
    assert.equal(
      manifest.launchAsset.hash,
      createHash('sha256').update('test bundle bytes').digest('base64url'),
    );
    const file = manifest.launchAsset.url.split('/').pop();
    assert.equal(readFileSync(path.join(options.outputDir, file), 'utf8'), 'test bundle bytes');
  }
});

test('preserves older native runtimes and rejects a wrong signing key', (t) => {
  const options = fixture(t);
  const previousCatalog = { version: 1, entries: { older: { preserved: true } } };
  assert.deepEqual(prepareUpdate({ ...options, previousCatalog }).catalog.entries.older, {
    preserved: true,
  });
  const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.throws(() => prepareUpdate({ ...options, privateKey: otherKey }), /signature/);
});

test('refuses a changed native target and unsafe exported paths', (t) => {
  const options = fixture(t);
  assert.throws(
    () =>
      prepareUpdate({
        ...options,
        nativeRuntimes: { ...nativeRuntimes, channel: 'preview-v0.1.0' },
      }),
    /mismatch/,
  );
  const metadataFile = path.join(options.exportDir, 'metadata.json');
  const metadata = JSON.parse(readFileSync(metadataFile));
  metadata.fileMetadata.ios.bundle = '../outside';
  writeFileSync(metadataFile, JSON.stringify(metadata));
  assert.throws(() => prepareUpdate(options), /Unsafe/);
});

test('prepares authenticated rollback for both platforms and leaves other runtimes intact', () => {
  const catalog = prepareRollback({
    nativeRuntimes,
    privateKey,
    certificate,
    previousCatalog: { version: 1, entries: { older: true } },
  });
  assert.equal(catalog.entries.older, true);
  const entry = catalog.entries[`${channel}/ios/${runtimeVersion}`];
  const directive = validateEntry(entry, { channel, platform: 'ios', runtimeVersion, certificate });
  assert.equal(directive.type, 'rollBackToEmbedded');
});
