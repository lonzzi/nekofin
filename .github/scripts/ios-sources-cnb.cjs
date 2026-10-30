const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { publishArtifacts } = require('./cnb-artifacts.cjs');
const { createClient, syncGitTag } = require('./cnb-release.cjs');
const { parseReleaseTag } = require('./release-metadata.cjs');
const { buildSource, metadataName } = require('./ios-sources.cjs');

function buildUpdateIndex(releases) {
  return {
    version: 1,
    releases: releases.flatMap((release) => {
      let parsed;
      try {
        parsed = parseReleaseTag(release.tag_name);
      } catch {
        return [];
      }
      if (release.draft || release.prerelease !== parsed.prerelease) return [];
      const tag = release.tag_name;
      const names = [`nekofin-${tag}-android-arm64.apk`, `nekofin-${tag}-ios-unsigned.ipa`];
      const assets = (release.assets ?? [])
        .filter((asset) => names.includes(asset.name) && asset.size > 0)
        .map((asset) => ({
          name: asset.name,
          size: asset.size,
          ...(asset.hash_algo && asset.hash_value
            ? { hash_algo: asset.hash_algo, hash_value: asset.hash_value }
            : {}),
        }));
      return assets.length
        ? [{ tag_name: tag, draft: false, prerelease: parsed.prerelease, assets }]
        : [];
    }),
  };
}

async function publishCnbSources(env = process.env, fetchImpl = fetch) {
  if (env.CNB_REPO !== 'lonzzi/nekofin' || !env.CNB_TOKEN)
    throw new Error('Configure the NekoFin CNB repository and token');
  const request = createClient(env.CNB_TOKEN, fetchImpl);
  const entries = [];
  const nativeReleases = [];
  for (let page = 1; ; page += 1) {
    const releases = await request('GET', `/${env.CNB_REPO}/-/releases?page=${page}&page_size=100`);
    if (!Array.isArray(releases)) throw new Error('Invalid CNB release list');
    for (const release of releases) {
      try {
        parseReleaseTag(release.tag_name);
      } catch {
        continue;
      }
      if (release.draft) continue;
      nativeReleases.push(release);
      const name = metadataName(release.tag_name);
      if (!release.assets?.some((asset) => asset.name === name && asset.size > 0)) continue;
      const response = await fetchImpl(
        `https://cnb.cool/${env.CNB_REPO}/-/releases/download/${encodeURIComponent(release.tag_name)}/${name}`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) throw new Error('CNB iOS source metadata is unavailable');
      const text = await response.text();
      if (text.length > 64_000) throw new Error('CNB iOS source metadata exceeds size limit');
      entries.push({
        release: {
          ...release,
          assets: release.assets.map((asset) => ({ ...asset, state: 'uploaded' })),
        },
        metadata: JSON.parse(text),
      });
    }
    if (releases.length < 100) break;
    if (page === 100) throw new Error('CNB release list could not be read completely');
  }
  if (!entries.length) throw new Error('No mirrored IPA metadata; refusing to replace CNB sources');
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-cnb-ios-'));
  try {
    const files = ['stable', 'beta'].map((channel) => {
      const filename = path.join(directory, `${channel}.json`);
      writeFileSync(filename, JSON.stringify(buildSource(entries, channel, 'cnb'), null, 2) + '\n');
      return filename;
    });
    const icon = path.resolve('assets/images/icon.png');
    const updateIndex = path.join(directory, 'updates.json');
    writeFileSync(updateIndex, JSON.stringify(buildUpdateIndex(nativeReleases)) + '\n');
    files.push(updateIndex);
    files.push(icon);
    const commit = syncGitTag(env.CNB_REPO, env.CNB_TOKEN, 'app-sources');
    await publishArtifacts({
      repository: env.CNB_REPO,
      token: env.CNB_TOKEN,
      tag: 'app-sources',
      commit,
      files,
      mutable: true,
      body: 'AltStore Classic / LiveContainer sources using verified CNB installers.',
      fetchImpl,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { buildUpdateIndex, publishCnbSources };
if (require.main === module)
  publishCnbSources().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
