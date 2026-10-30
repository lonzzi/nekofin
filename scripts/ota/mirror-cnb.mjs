import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import artifacts from '../../.github/scripts/cnb-artifacts.cjs';
import client from '../../.github/scripts/cnb-release.cjs';
import { REPOSITORY, validateEntry } from '../../updates/server/lib/protocol.mjs';

export function mirrorCatalog(catalog, { certificate, privateKey }) {
  if (
    catalog.version !== 1 ||
    !catalog.entries ||
    typeof catalog.entries !== 'object' ||
    Array.isArray(catalog.entries)
  )
    throw new Error('Invalid OTA catalog');
  const mirrored = { version: 1, entries: {} };
  const payloads = new Map();
  for (const [key, entry] of Object.entries(catalog.entries)) {
    const [channel, platform, runtimeVersion, extra] = key.split('/');
    if (extra || !['ios', 'android'].includes(platform)) throw new Error('Invalid catalog target');
    const target = { channel, platform, runtimeVersion, certificate };
    const manifest = validateEntry(entry, target);
    if (entry.kind === 'rollback') {
      mirrored.entries[key] = entry;
      continue;
    }
    for (const asset of [manifest.launchAsset, ...manifest.assets]) {
      const url = new URL(asset.url);
      const [tag, name, trailing] = url.pathname
        .slice(`/${REPOSITORY}/releases/download/`.length)
        .split('/');
      if (
        trailing ||
        !/^ota-[A-Za-z0-9.+-]+$/.test(tag) ||
        tag === 'ota-catalog' ||
        !/^asset-[a-f0-9]{64}\.bin$/.test(name)
      )
        throw new Error('Invalid immutable OTA asset');
      const sha256 = Buffer.from(asset.hash, 'base64url').toString('hex');
      if (name !== `asset-${sha256}.bin`) throw new Error('OTA asset filename/hash mismatch');
      if (!payloads.has(tag)) payloads.set(tag, new Map());
      const previous = payloads.get(tag).get(name);
      if (previous && previous !== sha256) throw new Error('Conflicting OTA asset hashes');
      payloads.get(tag).set(name, sha256);
      asset.url = `https://cnb.cool/${REPOSITORY}/-/releases/download/${tag}/${name}`;
    }
    const body = JSON.stringify(manifest);
    const mirror = {
      kind: 'update',
      body,
      signature: sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64'),
    };
    validateEntry(mirror, { ...target, source: 'cnb' });
    // The ID is preserved, so changing CDN does not offer the same update again.
    mirrored.entries[key] = mirror;
  }
  if (JSON.stringify(mirrored).length > 4_000_000)
    throw new Error('CNB catalog exceeds size limit');
  return { catalog: mirrored, payloads };
}

export async function publishCnbCatalog(privateKeyFile, env = process.env) {
  if (env.CNB_REPO !== REPOSITORY || !env.CNB_TOKEN)
    throw new Error('Configure CNB_REPO=lonzzi/nekofin and CNB_TOKEN');
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-cnb-ota-'));
  const gh = (...args) => execFileSync('gh', [...args, '--repo', REPOSITORY], { encoding: 'utf8' });
  try {
    const releases = JSON.parse(
      execFileSync('gh', ['api', `repos/${REPOSITORY}/releases`, '--paginate', '--slurp'], {
        encoding: 'utf8',
      }),
    ).flat();
    const catalogRelease = releases.find(
      (release) => release.tag_name === 'ota-catalog' && !release.draft,
    );
    if (!catalogRelease) {
      console.log('No published OTA catalog to mirror yet.');
      return;
    }
    const primaryFile = path.join(directory, 'github-catalog.json');
    gh('release', 'download', 'ota-catalog', '--pattern', 'catalog.json', '--output', primaryFile);
    const certificate = readFileSync(
      new URL('../../updates/server/ota-certificate.crt', import.meta.url),
      'utf8',
    );
    const { catalog, payloads } = mirrorCatalog(JSON.parse(readFileSync(primaryFile, 'utf8')), {
      certificate,
      privateKey: readFileSync(privateKeyFile, 'utf8'),
    });
    for (const [tag, hashes] of payloads) {
      const release = releases.find((item) => item.tag_name === tag && !item.draft);
      if (!release) throw new Error(`Missing published resource release: ${tag}`);
      const output = path.join(directory, tag);
      mkdirSync(output);
      for (const [name, expectedHash] of hashes) {
        const asset = release.assets.find(
          (item) => item.name === name && item.state === 'uploaded' && item.size > 0,
        );
        if (!asset || (asset.digest && asset.digest !== `sha256:${expectedHash}`))
          throw new Error('Resource asset metadata mismatch');
        const filename = path.join(output, name);
        gh('release', 'download', tag, '--pattern', name, '--output', filename);
        const data = readFileSync(filename);
        if (
          data.length !== asset.size ||
          createHash('sha256').update(data).digest('hex') !== expectedHash
        )
          throw new Error(`Resource checksum mismatch: ${name}`);
      }
      const commit = client.syncGitTag(REPOSITORY, env.CNB_TOKEN, tag);
      await artifacts.publishArtifacts({
        repository: REPOSITORY,
        token: env.CNB_TOKEN,
        tag,
        commit,
        files: [...hashes.keys()].map((name) => path.join(output, name)),
        body: `Signed NekoFin resource assets.\n\nhttps://github.com/${REPOSITORY}/releases/tag/${tag}`,
      });
    }
    // Validate the existing snapshot before retaining it as a rollback/replace backup.
    let previous = { version: 1, entries: {} };
    const request = client.createClient(env.CNB_TOKEN);
    const remote = await request(
      'GET',
      `/${REPOSITORY}/-/releases/tags/ota-catalog`,
      undefined,
      true,
    );
    if (remote && !remote.draft) {
      const response = await fetch(
        `https://cnb.cool/${REPOSITORY}/-/releases/download/ota-catalog/catalog.json`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) throw new Error('Cannot back up the existing CNB catalog');
      previous = await response.json();
      if (previous.version !== 1 || !previous.entries || Array.isArray(previous.entries))
        throw new Error('Invalid previous CNB catalog');
      for (const [key, entry] of Object.entries(previous.entries)) {
        const [channel, platform, runtimeVersion, extra] = key.split('/');
        if (extra) throw new Error('Invalid previous CNB catalog target');
        validateEntry(entry, { channel, platform, runtimeVersion, certificate, source: 'cnb' });
      }
    }
    const backup = path.join(directory, 'catalog-backup.json');
    const current = path.join(directory, 'catalog.json');
    writeFileSync(backup, JSON.stringify(previous) + '\n');
    writeFileSync(current, JSON.stringify(catalog) + '\n');
    const commit = client.syncGitTag(REPOSITORY, env.CNB_TOKEN, 'ota-catalog');
    await artifacts.publishArtifacts({
      repository: REPOSITORY,
      token: env.CNB_TOKEN,
      tag: 'ota-catalog',
      commit,
      files: [backup, current],
      mutable: true,
      body: 'Signed CNB resource update catalog. Resource IDs and checksums match the GitHub source.',
    });
    console.log(`Mirrored ${payloads.size} resource releases and promoted the signed CNB catalog.`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: mirror-cnb.mjs PRIVATE_KEY_FILE');
  await publishCnbCatalog(process.argv[2]);
}
