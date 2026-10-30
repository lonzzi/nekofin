import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { test } from 'node:test';

import { CATALOG_URL, CNB_CATALOG_URL, createUpdateHandler } from './protocol.mjs';

const { privateKey, publicKey: certificate } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const runtimeVersion = 'a'.repeat(40);
const channel = 'production-v0.1.0-beta.1';
const key = `${channel}/ios/${runtimeVersion}`;
const asset = {
  hash: 'a'.repeat(43),
  key: 'asset-key',
  contentType: 'application/octet-stream',
  url: 'https://github.com/lonzzi/nekofin/releases/download/ota-test/asset.bin',
};

function signed(body, kind = 'update') {
  const text = JSON.stringify(body);
  return {
    kind,
    body: text,
    signature: sign('RSA-SHA256', Buffer.from(text), privateKey).toString('base64'),
  };
}

function update(overrides = {}) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    runtimeVersion,
    metadata: { channel, platform: 'ios' },
    launchAsset: asset,
    assets: [asset],
    extra: {},
    ...overrides,
  };
}

function request(extra = {}) {
  return new Request('https://test/api/manifest', {
    headers: {
      'expo-protocol-version': '1',
      'expo-platform': 'ios',
      'expo-runtime-version': runtimeVersion,
      'expo-channel-name': channel,
      accept: 'application/expo+json, application/json, multipart/mixed',
      ...extra,
    },
  });
}

function handler(entry, options = {}) {
  let fetches = 0;
  const handle = createUpdateHandler({
    certificate,
    fetcher: async () => {
      fetches++;
      return new Response(JSON.stringify({ version: 1, entries: entry ? { [key]: entry } : {} }));
    },
    ...options,
  });
  return { handle, fetches: () => fetches };
}

test('serves a verified signed manifest with required protocol headers and immutable assets', async () => {
  const body = update();
  const { handle } = handler(signed(body));
  const response = await handle(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('expo-protocol-version'), '1');
  assert.equal(response.headers.get('expo-sfv-version'), '0');
  assert.match(response.headers.get('expo-signature'), /keyid="main"/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), body);
});

test('does not offer the running update again or updates for an unknown target', async () => {
  const body = update();
  const { handle } = handler(signed(body));
  assert.equal((await handle(request({ 'expo-current-update-id': body.id }))).status, 204);
  assert.equal((await handle(request({ 'expo-runtime-version': 'b'.repeat(40) }))).status, 204);
  assert.equal((await handle(request({ 'expo-platform': 'android' }))).status, 204);
});

test('negotiates signed JSON and multipart manifests and honors q=0', async () => {
  const server = handler(signed(update()));
  const multipart = await server.handle(request({ accept: 'multipart/mixed' }));
  assert.match(multipart.headers.get('content-type'), /multipart\/mixed/);
  assert.match(await multipart.text(), /name="manifest"/);
  const json = await server.handle(request({ accept: 'application/expo+json' }));
  assert.equal(json.headers.get('content-type'), 'application/expo+json');
  assert.equal((await server.handle(request({ accept: 'application/json;q=0' }))).status, 406);
});

test('rejects incompatible requests before accessing GitHub', async () => {
  const server = handler(signed(update()));
  for (const [headers, status] of [
    [{ 'expo-protocol-version': '0' }, 406],
    [{ 'expo-platform': 'web' }, 400],
    [{ 'expo-runtime-version': '../../bad' }, 400],
    [{ 'expo-channel-name': 'production' }, 400],
    [{ accept: 'text/html' }, 406],
  ])
    assert.equal((await server.handle(request(headers))).status, status);
  assert.equal(server.fetches(), 0);
});

test('rejects tampered, incompatible and off-repository payloads', async () => {
  const tampered = signed(update());
  tampered.body += ' ';
  for (const entry of [
    tampered,
    signed(update({ runtimeVersion: 'b'.repeat(40) })),
    signed(update({ metadata: { channel: 'preview-v0.1.0', platform: 'ios' } })),
    signed(update({ launchAsset: { ...asset, url: 'https://untrusted.example/code.js' } })),
  ])
    assert.equal((await handler(entry).handle(request())).status, 503);
});

test('sends signed rollback directives in a multipart response', async () => {
  const body = {
    type: 'rollBackToEmbedded',
    parameters: { commitTime: new Date().toISOString(), channel, platform: 'ios', runtimeVersion },
  };
  const { handle } = handler(signed(body, 'rollback'));
  const response = await handle(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /multipart\/mixed; boundary=/);
  const text = await response.text();
  assert.match(text, /name="directive"/);
  assert.match(text, /expo-signature: sig=/);
  assert.ok(text.includes(JSON.stringify(body)));
  assert.equal((await handle(request({ accept: 'application/json' }))).status, 406);
  const crossChannel = { ...body, parameters: { ...body.parameters, channel: 'preview-v0.1.0' } };
  assert.equal((await handler(signed(crossChannel, 'rollback')).handle(request())).status, 503);
});

test('coalesces concurrent catalog reads and refreshes after one minute', async () => {
  let now = 1_000;
  const server = handler(signed(update()), { now: () => now });
  await Promise.all([server.handle(request()), server.handle(request())]);
  await server.handle(request());
  assert.equal(server.fetches(), 1);
  now += 60_000;
  await server.handle(request());
  assert.equal(server.fetches(), 2);
});

test('treats an absent initial catalog as no update and outages as retryable failures', async () => {
  const missing = handler(null, { fetcher: async () => new Response(null, { status: 404 }) });
  assert.equal((await missing.handle(request())).status, 204);
  const unavailable = handler(null, {
    fetcher: async () => {
      throw new Error('offline');
    },
  });
  assert.equal((await unavailable.handle(request())).status, 503);
});

test('uses the signed backup while catalog promotion temporarily removes the primary asset', async () => {
  let calls = 0;
  const body = update();
  const server = handler(null, {
    fetcher: async (url) => {
      calls++;
      if (!url.includes('catalog-backup.json')) return new Response(null, { status: 404 });
      return new Response(JSON.stringify({ version: 1, entries: { [key]: signed(body) } }));
    },
  });
  const response = await server.handle(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, body.id);
  assert.equal(calls, 2);
});

test('routes persisted Expo extra parameters to independently cached, signed CNB catalogs', async () => {
  const original = update();
  const mirroredAsset = {
    ...asset,
    url: 'https://cnb.cool/lonzzi/nekofin/-/releases/download/ota-test/asset.bin',
  };
  const mirrored = { ...original, launchAsset: mirroredAsset, assets: [mirroredAsset] };
  const urls = [];
  const server = handler(null, {
    fetcher: async (url) => {
      urls.push(url);
      return new Response(
        JSON.stringify({
          version: 1,
          entries: { [key]: signed(url.startsWith(CNB_CATALOG_URL) ? mirrored : original) },
        }),
      );
    },
  });
  const cnbRequest = request({ 'expo-extra-params': 'other="value", nekofin-source="cnb"' });
  const responses = await Promise.all([
    server.handle(request()),
    server.handle(cnbRequest),
    server.handle(cnbRequest),
  ]);
  assert.deepEqual(await responses[0].json(), original);
  assert.deepEqual(await responses[1].json(), mirrored);
  assert.equal(responses[2].headers.get('vary'), 'Expo-Extra-Params');
  assert.equal(urls.length, 2);
  assert.ok(urls.some((url) => url.startsWith(CATALOG_URL)));
  assert.ok(urls.some((url) => url.startsWith(CNB_CATALOG_URL)));
  assert.equal(
    (
      await server.handle(
        request({
          'expo-extra-params': 'nekofin-source=cnb',
          'expo-current-update-id': original.id,
        }),
      )
    ).status,
    204,
  );
});

test('rejects unknown or duplicate update sources before reading any catalog', async () => {
  const server = handler(null);
  for (const value of [
    'nekofin-source="evil"',
    'nekofin-source=cnb, nekofin-source=github',
    'nekofin-source="cnb";unsafe=?1',
  ])
    assert.equal((await server.handle(request({ 'expo-extra-params': value }))).status, 400);
  assert.equal(server.fetches(), 0);
});

test('requires signatures and source-specific origins even for a trusted signed catalog', async () => {
  const cnbAsset = {
    ...asset,
    url: 'https://cnb.cool/lonzzi/nekofin/-/releases/download/ota-test/asset.bin',
  };
  const cnb = signed(update({ launchAsset: cnbAsset, assets: [cnbAsset] }));
  assert.equal((await handler(cnb).handle(request())).status, 503);
  assert.equal(
    (await handler(signed(update())).handle(request({ 'expo-extra-params': 'nekofin-source=cnb' })))
      .status,
    503,
  );
  cnb.body += ' ';
  assert.equal(
    (await handler(cnb).handle(request({ 'expo-extra-params': 'nekofin-source=cnb' }))).status,
    503,
  );
});
