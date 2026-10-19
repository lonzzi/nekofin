import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { REPOSITORY, validateEntry } from '../../updates/server/lib/protocol.mjs';
import { prepareRollback, prepareUpdate } from './prepare.mjs';
import { resolveRuntimes } from './runtime.mjs';

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0)
    throw new Error(`${command} failed: ${capture ? result.stderr : result.status}`);
  return result.stdout;
}

function gh(args, options) {
  return run('gh', [...args, '--repo', REPOSITORY], options);
}

function readRelease(tag) {
  const result = spawnSync('gh', ['api', `repos/${REPOSITORY}/releases/tags/${tag}`], {
    encoding: 'utf8',
  });
  if (result.status === 0) return JSON.parse(result.stdout);
  if (/HTTP 404/.test(result.stderr)) return null;
  throw new Error('Cannot read release metadata; refusing to overwrite the update catalog.');
}

export function assertCompatibleRuntime(expected, actual) {
  if (
    expected.version !== 1 ||
    expected.releaseTag !== actual.releaseTag ||
    expected.channel !== actual.channel ||
    expected.url !== actual.url ||
    (expected.iosBuildNumber ?? '1') !== (actual.iosBuildNumber ?? '1') ||
    ['ios', 'android'].some(
      (platform) => expected.runtimes?.[platform] !== actual.runtimes?.[platform],
    )
  ) {
    throw new Error('Native runtime changed. Publish a new APK/IPA before shipping this update.');
  }
}

function validateCatalog(catalog, certificate) {
  if (
    catalog.version !== 1 ||
    !catalog.entries ||
    typeof catalog.entries !== 'object' ||
    Array.isArray(catalog.entries)
  )
    throw new Error('Invalid catalog');
  for (const [key, entry] of Object.entries(catalog.entries)) {
    const [channel, platform, runtimeVersion, extra] = key.split('/');
    if (extra || !['ios', 'android'].includes(platform)) throw new Error('Invalid catalog target');
    validateEntry(entry, { channel, platform, runtimeVersion, certificate });
  }
}

export async function publish({
  nativeRuntimesFile,
  privateKeyFile,
  operation = 'update',
  message = '',
  tag,
}) {
  if (!['update', 'rollback'].includes(operation)) throw new Error('Unsupported OTA operation');
  if (
    operation === 'update' &&
    (!/^ota-[A-Za-z0-9.+-]+$/.test(tag ?? '') || tag === 'ota-catalog')
  ) {
    throw new Error('Invalid immutable OTA release tag');
  }
  const directory = path.resolve(
    'build/ota-publish',
    operation === 'update' ? tag : `rollback-${Date.now()}`,
  );
  mkdirSync(directory, { recursive: true });
  const nativeRuntimes = JSON.parse(readFileSync(nativeRuntimesFile, 'utf8'));
  // Use the installed binary's build identity for both fingerprinting and JS export.
  process.env.NEKOFIN_IOS_BUILD_NUMBER = nativeRuntimes.iosBuildNumber ?? '1';
  const certificate = readFileSync('updates/server/ota-certificate.crt', 'utf8');
  const privateKey = readFileSync(privateKeyFile, 'utf8');
  if (!/^(production|preview)-v[0-9A-Za-z.+-]+$/.test(nativeRuntimes.channel))
    throw new Error('Invalid native channel');
  const catalogFile = path.join(directory, 'catalog.json');
  const catalogRelease = readRelease('ota-catalog');
  let previousCatalog = { version: 1, entries: {} };
  if (catalogRelease) {
    const asset = ['catalog.json', 'catalog-backup.json'].find((name) =>
      catalogRelease.assets.some(
        (asset) => asset.name === name && asset.state === 'uploaded' && asset.size > 0,
      ),
    );
    if (!asset && !catalogRelease.draft)
      throw new Error('Published OTA catalog has no recoverable snapshot.');
    if (asset) {
      gh([
        'release',
        'download',
        'ota-catalog',
        '--pattern',
        asset,
        '--output',
        catalogFile,
        '--clobber',
      ]);
      previousCatalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
      validateCatalog(previousCatalog, certificate);
    }
  }

  let catalog;
  if (operation === 'rollback') {
    catalog = prepareRollback({ nativeRuntimes, previousCatalog, certificate, privateKey });
  } else {
    assertCompatibleRuntime(nativeRuntimes, await resolveRuntimes());
    const exportDir = path.join(directory, 'export');
    run('bunx', [
      'expo',
      'export',
      '--platform',
      'ios',
      '--platform',
      'android',
      '--max-workers',
      '4',
      '--output-dir',
      exportDir,
    ]);
    const config = JSON.parse(
      run('bunx', ['expo', 'config', '--type', 'public', '--json'], { capture: true }),
    );
    const outputDir = path.join(directory, 'assets');
    // A rerun must not accidentally upload assets left by a previous operation.
    if (readdirSync(directory).includes('assets'))
      throw new Error('Use a fresh build/ota-publish directory for each publish.');
    const prepared = prepareUpdate({
      exportDir,
      outputDir,
      config,
      nativeRuntimes,
      tag,
      privateKey,
      certificate,
      previousCatalog,
      message,
      commit: process.env.GITHUB_SHA ?? '',
    });
    catalog = prepared.catalog;
    const existing = readRelease(tag);
    if (existing && !existing.draft)
      throw new Error('OTA release already published; its assets are immutable.');
    if (!existing)
      gh([
        'release',
        'create',
        tag,
        '--draft',
        '--prerelease',
        '--latest=false',
        '--title',
        tag,
        '--target',
        process.env.GITHUB_SHA ?? 'main',
        '--notes',
        message || 'Signed NekoFin resource update.',
      ]);
    const assets = readdirSync(outputDir)
      .filter((file) => file !== 'catalog.json')
      .map((file) => path.join(outputDir, file));
    gh(['release', 'upload', tag, ...assets, '--clobber']);
    gh(['release', 'edit', tag, '--draft=false', '--prerelease=true', '--latest=false']);
  }

  validateCatalog(catalog, certificate);
  writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
  if (!catalogRelease)
    gh([
      'release',
      'create',
      'ota-catalog',
      '--draft',
      '--prerelease',
      '--latest=false',
      '--title',
      'OTA catalog',
      '--target',
      process.env.GITHUB_SHA ?? 'main',
      '--notes',
      'Signed update pointers; update payloads are stored in immutable ota-* releases.',
    ]);
  // Only the small pointer catalog is mutable. Published update assets are never replaced.
  const backupFile = path.join(directory, 'catalog-backup.json');
  writeFileSync(backupFile, JSON.stringify(previousCatalog, null, 2) + '\n');
  gh(['release', 'upload', 'ota-catalog', backupFile, '--clobber']);
  gh(['release', 'upload', 'ota-catalog', catalogFile, '--clobber']);
  if (!catalogRelease || catalogRelease.draft)
    gh(['release', 'edit', 'ota-catalog', '--draft=false', '--prerelease=true', '--latest=false']);
  console.log(`Published ${operation} for ${nativeRuntimes.channel}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [nativeRuntimesFile, privateKeyFile, operation = 'update', tag] = process.argv.slice(2);
  if (!privateKeyFile || (operation === 'update' && !tag))
    throw new Error('Usage: publish.mjs NATIVE_RUNTIMES PRIVATE_KEY update|rollback [OTA_TAG]');
  await publish({
    nativeRuntimesFile,
    privateKeyFile,
    operation,
    tag,
    message: process.env.OTA_MESSAGE ?? '',
  });
}
