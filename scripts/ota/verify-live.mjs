import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

import { validateEntry } from '../../updates/server/lib/protocol.mjs';

const native = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const certificate = readFileSync('updates/server/ota-certificate.crt', 'utf8');
const downloads = new Map();
const execute = promisify(execFile);
for (const platform of ['ios', 'android']) {
  const headers = {
    'expo-protocol-version': '1',
    'expo-platform': platform,
    'expo-runtime-version': native.runtimes[platform],
    'expo-channel-name': native.channel,
    accept: 'application/json, application/expo+json, multipart/mixed',
  };
  const response = await fetch(native.url, { headers, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `Unexpected ${platform} update status`);
  const body = await response.text();
  const signature = response.headers.get('expo-signature')?.match(/sig="([^"]+)"/)?.[1];
  const manifest = validateEntry(
    { kind: 'update', body, signature },
    {
      channel: native.channel,
      platform,
      runtimeVersion: native.runtimes[platform],
      certificate,
    },
  );
  let bytes = 0;
  const assets = [manifest.launchAsset, ...manifest.assets];
  for (let offset = 0; offset < assets.length; offset += 4) {
    await Promise.all(
      assets.slice(offset, offset + 4).map(async (asset) => {
        if (!downloads.has(asset.url)) {
          downloads.set(
            asset.url,
            (async () => {
              // curl follows GitHub's signed asset redirects and retries transient TLS resets.
              const { stdout } = await execute(
                'curl',
                [
                  '--location',
                  '--fail',
                  '--silent',
                  '--show-error',
                  '--retry',
                  '2',
                  '--retry-all-errors',
                  '--max-time',
                  '60',
                  asset.url,
                ],
                { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: 190_000 },
              );
              return Buffer.from(stdout);
            })(),
          );
        }
        const buffer = await downloads.get(asset.url);
        assert.equal(
          createHash('sha256').update(buffer).digest('base64url'),
          asset.hash,
          'Asset digest mismatch',
        );
        bytes += buffer.length;
      }),
    );
  }
  const current = await fetch(native.url, {
    headers: { ...headers, 'expo-current-update-id': manifest.id },
  });
  assert.equal(current.status, 204, 'Running update was offered again');
  console.log(
    JSON.stringify({
      platform,
      updateId: manifest.id,
      assets: assets.length,
      bytes,
      signatureVerified: true,
    }),
  );
}
