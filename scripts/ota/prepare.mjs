import { Buffer } from 'node:buffer';
import { createHash, randomUUID, sign } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { REPOSITORY, validateEntry } from '../../updates/server/lib/protocol.mjs';

function readExportFile(exportDir, relativePath) {
  const file = path.resolve(exportDir, relativePath);
  if (!file.startsWith(path.resolve(exportDir) + path.sep))
    throw new Error('Unsafe export asset path');
  return { file, bytes: readFileSync(file) };
}

export function prepareUpdate({
  exportDir,
  outputDir,
  config,
  nativeRuntimes,
  tag,
  privateKey,
  certificate,
  previousCatalog = { version: 1, entries: {} },
  message = '',
  commit = '',
  createdAt = new Date().toISOString(),
}) {
  if (!/^ota-[a-zA-Z0-9.+-]+$/.test(tag) || tag === 'ota-catalog')
    throw new Error('Invalid immutable OTA tag');
  if (
    previousCatalog.version !== 1 ||
    !previousCatalog.entries ||
    Array.isArray(previousCatalog.entries)
  )
    throw new Error('Invalid previous catalog');
  const channel = config.updates?.requestHeaders?.['expo-channel-name'];
  if (channel !== nativeRuntimes.channel || config.updates.url !== nativeRuntimes.url)
    throw new Error('Native OTA configuration mismatch');
  const metadata = JSON.parse(readFileSync(path.join(exportDir, 'metadata.json'), 'utf8'));
  const catalog = { version: 1, entries: { ...previousCatalog.entries } };
  const entries = {};
  mkdirSync(outputDir, { recursive: true });

  function asset(relativePath, extension, launch = false) {
    const { file, bytes } = readExportFile(exportDir, relativePath);
    const digest = createHash('sha256').update(bytes).digest();
    const name = `asset-${digest.toString('hex')}.bin`;
    copyFileSync(file, path.join(outputDir, name));
    return {
      hash: digest.toString('base64url'),
      key: launch
        ? digest.toString('hex')
        : path.basename(relativePath, path.extname(relativePath)),
      contentType: 'application/octet-stream',
      ...(!launch ? { fileExtension: `.${extension}` } : {}),
      url: `https://github.com/${REPOSITORY}/releases/download/${tag}/${name}`,
    };
  }

  for (const platform of ['ios', 'android']) {
    const files = metadata.fileMetadata?.[platform];
    const runtimeVersion = nativeRuntimes.runtimes[platform];
    if (!files || !/^[a-f0-9]{40,64}$/.test(runtimeVersion ?? ''))
      throw new Error(`Missing ${platform} export/runtime`);
    const manifest = {
      id: randomUUID(),
      createdAt,
      runtimeVersion,
      launchAsset: asset(files.bundle, '', true),
      assets: files.assets.map((item) => asset(item.path, item.ext)),
      metadata: { channel, platform, message, commit },
      extra: { expoClient: config },
    };
    const body = JSON.stringify(manifest);
    const entry = {
      kind: 'update',
      body,
      signature: sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64'),
    };
    validateEntry(entry, { channel, platform, runtimeVersion, certificate });
    const key = `${channel}/${platform}/${runtimeVersion}`;
    entries[key] = entry;
    catalog.entries[key] = entry;
  }
  if (JSON.stringify(catalog).length > 4_000_000)
    throw new Error('Catalog exceeds the server size limit');
  writeFileSync(
    path.join(outputDir, 'payload.json'),
    JSON.stringify({ version: 1, entries }, null, 2) + '\n',
  );
  writeFileSync(path.join(outputDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  return { catalog, entries };
}

export function prepareRollback({
  nativeRuntimes,
  previousCatalog,
  privateKey,
  certificate,
  commitTime = new Date().toISOString(),
}) {
  const catalog = { version: 1, entries: { ...previousCatalog.entries } };
  for (const platform of ['ios', 'android']) {
    const { channel } = nativeRuntimes;
    const runtimeVersion = nativeRuntimes.runtimes[platform];
    const body = JSON.stringify({
      type: 'rollBackToEmbedded',
      parameters: { commitTime, channel, platform, runtimeVersion },
    });
    const entry = {
      kind: 'rollback',
      body,
      signature: sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64'),
    };
    validateEntry(entry, { channel, platform, runtimeVersion, certificate });
    catalog.entries[`${channel}/${platform}/${runtimeVersion}`] = entry;
  }
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [
    exportDir,
    nativeRuntimesFile,
    configFile,
    previousCatalogFile,
    outputDir,
    tag,
    privateKeyFile,
  ] = process.argv.slice(2);
  if (!privateKeyFile)
    throw new Error('Usage: prepare.mjs EXPORT RUNTIMES CONFIG CATALOG OUTPUT TAG PRIVATE_KEY');
  prepareUpdate({
    exportDir,
    outputDir,
    tag,
    nativeRuntimes: JSON.parse(readFileSync(nativeRuntimesFile, 'utf8')),
    config: JSON.parse(readFileSync(configFile, 'utf8')),
    previousCatalog: JSON.parse(readFileSync(previousCatalogFile, 'utf8')),
    privateKey: readFileSync(privateKeyFile, 'utf8'),
    certificate: readFileSync('updates/server/ota-certificate.crt', 'utf8'),
    message: process.env.OTA_MESSAGE ?? '',
    commit: process.env.GITHUB_SHA ?? '',
  });
}
