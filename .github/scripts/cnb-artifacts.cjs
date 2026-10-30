const { createHash } = require('node:crypto');
const { createReadStream, statSync } = require('node:fs');
const path = require('node:path');
const {
  createClient,
  uploadAsset,
  validateRepository,
  verifyPublicAssets,
} = require('./cnb-release.cjs');

async function assetsFromFiles(files) {
  const assets = [];
  const names = new Set();
  for (const filename of files) {
    const name = path.basename(filename);
    if (names.has(name) || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(name))
      throw new Error('Invalid or duplicate artifact name');
    names.add(name);
    const size = statSync(filename).size;
    if (!size) throw new Error(`Empty artifact: ${name}`);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filename)) hash.update(chunk);
    assets.push({ name, filename, size, sha256: hash.digest('hex') });
  }
  if (!assets.length) throw new Error('No artifacts to publish');
  return assets;
}

async function publishArtifacts({
  repository,
  token,
  tag,
  commit,
  files,
  body,
  mutable = false,
  fetchImpl = fetch,
}) {
  validateRepository(repository);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,160}$/.test(tag)) throw new Error('Invalid artifact tag');
  // Only the two small, documented catalogs may replace already published attachments.
  if (mutable && !['ota-catalog', 'app-sources'].includes(tag))
    throw new Error('Only pointer catalogs are mutable');
  const assets = await assetsFromFiles(files);
  const request = createClient(token, fetchImpl);
  const root = `/${repository}/-/releases`;
  let release = await request('GET', `${root}/tags/${encodeURIComponent(tag)}`, undefined, true);
  if (!release) {
    try {
      release = await request('POST', root, {
        tag_name: tag,
        target_commitish: commit,
        name: tag,
        body,
        draft: true,
        prerelease: true,
        make_latest: 'false',
      });
    } catch (error) {
      release = await request('GET', `${root}/tags/${encodeURIComponent(tag)}`, undefined, true);
      if (!release) throw error;
    }
  }
  if (!release?.id || release.tag_name !== tag)
    throw new Error('CNB returned an unexpected artifact release');
  const releasePath = `${root}/${encodeURIComponent(release.id)}`;
  if (release.draft || mutable) {
    for (const asset of assets) {
      console.log(`Uploading CNB ${tag}/${asset.name}`);
      await uploadAsset(request, fetchImpl, releasePath, asset);
    }
    const uploaded = await request('GET', releasePath);
    for (const asset of assets) {
      if (
        !uploaded.assets?.some((remote) => remote.name === asset.name && remote.size === asset.size)
      )
        throw new Error(`Incomplete CNB artifact: ${asset.name}`);
    }
    if (release.draft)
      await request('PATCH', releasePath, { draft: false, prerelease: true, make_latest: 'false' });
  }
  await verifyPublicAssets(fetchImpl, repository, tag, assets);
  return `https://cnb.cool/${repository}/-/releases/tag/${encodeURIComponent(tag)}`;
}

module.exports = { assetsFromFiles, publishArtifacts };
