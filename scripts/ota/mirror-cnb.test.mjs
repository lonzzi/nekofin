import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { test } from 'node:test';

import { validateEntry } from '../../updates/server/lib/protocol.mjs';
import { mirrorCatalog } from './mirror-cnb.mjs';

const { privateKey, publicKey: certificate } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const target = {
  channel: 'production-v0.1.0-beta.8',
  platform: 'ios',
  runtimeVersion: 'a'.repeat(40),
  certificate,
};
const key = `${target.channel}/${target.platform}/${target.runtimeVersion}`;
const hash = 'b'.repeat(64);
const name = `asset-${hash}.bin`;
const asset = {
  key: hash,
  hash: Buffer.from(hash, 'hex').toString('base64url'),
  contentType: 'application/javascript',
  url: `https://github.com/lonzzi/nekofin/releases/download/ota-123/${name}`,
};
function signed(value, kind = 'update') {
  const body = JSON.stringify(value);
  return {
    kind,
    body,
    signature: sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64'),
  };
}
function manifest() {
  return {
    id: randomUUID(),
    createdAt: '2026-10-30T00:00:00.000Z',
    runtimeVersion: target.runtimeVersion,
    metadata: { channel: target.channel, platform: target.platform },
    launchAsset: asset,
    assets: [{ ...asset }],
    extra: { expoClient: { name: 'NekoFin' } },
  };
}

test('mirrors immutable URLs, re-signs and preserves IDs, runtimes, timestamps and hashes', () => {
  const original = manifest();
  const input = { version: 1, entries: { [key]: signed(original) } };
  const result = mirrorCatalog(input, { certificate, privateKey });
  const mirrored = validateEntry(result.catalog.entries[key], { ...target, source: 'cnb' });
  assert.equal(mirrored.id, original.id);
  assert.equal(mirrored.createdAt, original.createdAt);
  assert.deepEqual(mirrored.extra, original.extra);
  assert.equal(mirrored.launchAsset.hash, asset.hash);
  assert.equal(
    mirrored.launchAsset.url,
    `https://cnb.cool/lonzzi/nekofin/-/releases/download/ota-123/${name}`,
  );
  assert.deepEqual([...result.payloads.get('ota-123')], [[name, hash]]);
  assert.equal(JSON.parse(input.entries[key].body).launchAsset.url, asset.url);
  assert.throws(() => validateEntry(result.catalog.entries[key], target), /Incompatible/);
});

test('copies signed rollback directives unchanged without requiring payload uploads', () => {
  const entry = signed(
    {
      type: 'rollBackToEmbedded',
      parameters: {
        commitTime: '2026-10-30T00:00:00Z',
        channel: target.channel,
        platform: target.platform,
        runtimeVersion: target.runtimeVersion,
      },
    },
    'rollback',
  );
  const result = mirrorCatalog(
    { version: 1, entries: { [key]: entry } },
    { certificate, privateKey },
  );
  assert.deepEqual(result.catalog.entries[key], entry);
  assert.equal(result.payloads.size, 0);
});

test('refuses tampering, hash/name mismatch, wrong private keys and foreign assets', () => {
  const original = manifest();
  const tampered = signed(original);
  tampered.body += ' ';
  const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const wrap = (entry) => ({ version: 1, entries: { [key]: entry } });
  assert.throws(() => mirrorCatalog(wrap(tampered), { certificate, privateKey }), /signature/);
  assert.throws(
    () => mirrorCatalog(wrap(signed(original)), { certificate, privateKey: wrongKey }),
    /signature/,
  );
  for (const url of [
    asset.url.replace(name, 'asset-' + 'c'.repeat(64) + '.bin'),
    asset.url.replace('github.com', 'other.example'),
    asset.url.replace('ota-123', 'ota-catalog'),
  ])
    assert.throws(() =>
      mirrorCatalog(wrap(signed({ ...original, launchAsset: { ...asset, url } })), {
        certificate,
        privateKey,
      }),
    );
});
