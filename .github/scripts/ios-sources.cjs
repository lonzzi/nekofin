const { rcompare, valid, prerelease } = require('semver');
const { spawnSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseReleaseTag } = require('./release-metadata.cjs');
const REPOSITORY = 'lonzzi/nekofin';
const CATALOG_TAG = 'app-sources';
const SOURCE_ROOT = `https://github.com/${REPOSITORY}/releases/download/${CATALOG_TAG}`;

function metadataName(tag) {
  return `nekofin-${tag}-ios-source.json`;
}

function buildSource(entries, channel, source = 'github') {
  if (!['stable', 'beta'].includes(channel)) throw new Error('Invalid source channel');
  if (!['github', 'cnb'].includes(source)) throw new Error('Invalid download source');
  const downloadRoot =
    source === 'cnb'
      ? `https://cnb.cool/${REPOSITORY}/-/releases/download`
      : `https://github.com/${REPOSITORY}/releases/download`;
  const releases = entries
    .filter(
      ({ release }) =>
        !release.draft && valid(release.tag_name?.slice(1)) && release.tag_name.startsWith('v'),
    )
    .filter(({ release }) => release.prerelease === !!prerelease(release.tag_name.slice(1)))
    .filter(({ release }) => channel === 'beta' || !release.prerelease)
    .sort((a, b) => rcompare(a.release.tag_name.slice(1), b.release.tag_name.slice(1)));
  const identities = new Set();
  const versions = releases.map(({ release, metadata }) => {
    const tag = release.tag_name;
    const parsed = parseReleaseTag(tag);
    const name = `nekofin-${tag}-ios-unsigned.ipa`;
    const asset = release.assets.find(
      (asset) => asset.name === name && asset.state === 'uploaded' && asset.size > 0,
    );
    if (
      !asset ||
      metadata.tag !== tag ||
      metadata.bundleIdentifier !== 'com.lonzzi.nekofin' ||
      metadata.version !== parsed.version ||
      metadata.size !== asset.size ||
      !/^[1-9]\d{0,3}(?:\.(?:0|[1-9]\d?)){0,2}$/.test(metadata.buildVersion) ||
      !/^\d+\.\d+(?:\.\d+)?$/.test(metadata.minOSVersion) ||
      !metadata.appPermissions ||
      !Array.isArray(metadata.appPermissions.entitlements) ||
      !metadata.appPermissions.privacy ||
      typeof metadata.appPermissions.privacy !== 'object'
    )
      throw new Error(`Invalid source metadata for ${tag}`);
    const identity = `${metadata.version}/${metadata.buildVersion}`;
    if (identities.has(identity)) throw new Error(`Repeated IPA version/build identity: ${tag}`);
    identities.add(identity);
    return {
      version: metadata.version,
      buildVersion: metadata.buildVersion,
      // LiveContainer currently decodes the same field using this legacy spelling.
      buildNumber: metadata.buildVersion,
      marketingVersion: tag.slice(1),
      date: release.published_at,
      localizedDescription: release.body || `NekoFin ${tag}`,
      downloadURL: `${downloadRoot}/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`,
      size: asset.size,
      minOSVersion: metadata.minOSVersion,
    };
  });
  const permissions = { entitlements: [], privacy: {} };
  for (const { metadata } of releases) {
    permissions.entitlements.push(...metadata.appPermissions.entitlements);
    Object.assign(permissions.privacy, metadata.appPermissions.privacy);
  }
  permissions.entitlements = [...new Set(permissions.entitlements)].sort();
  return {
    name: `NekoFin${channel === 'beta' ? ' Beta' : ''}${source === 'cnb' ? ' (CNB)' : ''}`,
    identifier: `com.lonzzi.nekofin.source.${source === 'cnb' ? 'cnb.' : ''}${channel}`,
    sourceURL: `${downloadRoot}/${CATALOG_TAG}/${channel}.json`,
    website: `https://github.com/${REPOSITORY}`,
    apps: versions.length
      ? [
          {
            name: 'NekoFin',
            bundleIdentifier: 'com.lonzzi.nekofin',
            developerName: 'lonzzi',
            subtitle: 'Jellyfin 与 Emby 播放器',
            localizedDescription: '连接自己的媒体服务器，浏览和播放影音内容。',
            iconURL:
              source === 'cnb'
                ? `${downloadRoot}/${CATALOG_TAG}/icon.png`
                : `https://raw.githubusercontent.com/${REPOSITORY}/main/assets/images/icon.png`,
            tintColor: '#1E1E1E',
            versions,
            appPermissions: permissions,
          },
        ]
      : [],
    news: [],
  };
}

function publishSources(directory = 'build/ios-sources') {
  mkdirSync(directory, { recursive: true });
  const gh = (args, json = false) => {
    const result = spawnSync('gh', args[0] === 'api' ? args : [...args, '--repo', REPOSITORY], {
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(result.stderr || 'GitHub source publication failed');
    return json ? JSON.parse(result.stdout) : result.stdout;
  };
  // Read every page; OTA/catalog releases must not push installer releases out of a fixed window.
  const pages = gh(
    ['api', `repos/${REPOSITORY}/releases?per_page=100`, '--paginate', '--slurp'],
    true,
  );
  const entries = [];
  for (const release of pages.flat()) {
    try {
      parseReleaseTag(release.tag_name);
    } catch {
      continue;
    }
    if (release.draft) continue;
    const name = metadataName(release.tag_name);
    if (!release.assets.some((asset) => asset.name === name && asset.state === 'uploaded'))
      continue;
    const output = join(directory, name);
    gh([
      'release',
      'download',
      release.tag_name,
      '--pattern',
      name,
      '--output',
      output,
      '--clobber',
    ]);
    entries.push({ release, metadata: JSON.parse(readFileSync(output, 'utf8')) });
  }
  if (!entries.length)
    throw new Error('No published IPA source metadata; refusing to replace sources');
  const files = ['stable', 'beta'].map((channel) => {
    const file = join(directory, `${channel}.json`);
    writeFileSync(file, JSON.stringify(buildSource(entries, channel), null, 2) + '\n');
    return file;
  });
  const existing = pages.flat().find((release) => release.tag_name === CATALOG_TAG);
  if (!existing)
    gh([
      'release',
      'create',
      CATALOG_TAG,
      '--draft',
      '--latest=false',
      '--title',
      'NekoFin iOS Sources',
      '--notes',
      'AltStore Classic / LiveContainer sources. Updated automatically after installer releases.',
    ]);
  // Validate both catalogs before replacing either live file. GitHub briefly returns 404 while replacing an asset; clients can retry.
  gh(['release', 'upload', CATALOG_TAG, ...files, '--clobber']);
  gh(['release', 'edit', CATALOG_TAG, '--draft=false', '--latest=false']);
}
module.exports = { buildSource, metadataName, publishSources };
if (require.main === module) publishSources(process.argv[2]);
