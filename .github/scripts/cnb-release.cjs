const { Buffer } = require('node:buffer');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  createReadStream,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { finished } = require('node:stream/promises');
const { setTimeout: delay } = require('node:timers/promises');
const { gt, valid } = require('semver');

const { parseReleaseTag } = require('./release-metadata.cjs');

const API = 'https://api.cnb.cool';
const START = '<!-- nekofin:cnb-downloads:start -->';
const END = '<!-- nekofin:cnb-downloads:end -->';

function validateRepository(repository) {
  if (
    typeof repository !== 'string' ||
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+$/.test(repository) ||
    repository.split('/').some((part) => part === '.' || part === '..') ||
    repository.endsWith('.git')
  ) {
    throw new Error('CNB_REPO must be a repository path such as lonzzi/nekofin.');
  }
  return repository;
}

function assetNames(tag) {
  parseReleaseTag(tag);
  return [
    `nekofin-${tag}-android-arm64.apk`,
    `nekofin-${tag}-ios-unsigned.ipa`,
    `nekofin-${tag}-runtimes.json`,
    `nekofin-${tag}-ios-source.json`,
    'SHA256SUMS',
  ];
}

async function digestFile(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function validateAssets(directory, tag) {
  const checksums = new Map();
  for (const line of readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8')
    .trim()
    .split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) [ *](?:\.\/)?([^/]+)$/.exec(line);
    if (!match || checksums.has(match[2]))
      throw new Error('Invalid or duplicate SHA256SUMS entry.');
    checksums.set(match[2], match[1]);
  }
  const assets = [];
  for (const name of assetNames(tag)) {
    const filename = path.join(directory, name);
    const size = statSync(filename).size;
    if (!size) throw new Error(`Empty release asset: ${name}`);
    const sha256 = await digestFile(filename);
    if (name !== 'SHA256SUMS' && checksums.get(name) !== sha256) {
      throw new Error(`Release checksum mismatch: ${name}`);
    }
    assets.push({ name, filename, size, sha256 });
  }
  return assets;
}

function withoutMirrorNotes(body) {
  return (body || '').replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'g'), '').trimEnd();
}

function withMirrorNotes(body, repository, tag) {
  validateRepository(repository);
  const names = assetNames(tag);
  const base = `https://cnb.cool/${repository}/-/releases`;
  const download = `${base}/download/${encodeURIComponent(tag)}`;
  return (
    `${withoutMirrorNotes(body)}\n\n${START}\n## CNB 下载 / Downloads\n\n` +
    `- [CNB Release](${base}/tag/${encodeURIComponent(tag)})\n` +
    `- [Android arm64 APK](${download}/${encodeURIComponent(names[0])})\n` +
    `- [iOS 未签名 IPA / unsigned IPA](${download}/${encodeURIComponent(names[1])})\n` +
    `- [SHA256SUMS](${download}/SHA256SUMS)\n${END}\n`
  );
}

function createClient(token, fetchImpl = fetch) {
  return async function request(method, pathname, body, allowMissing = false) {
    const url = new URL(pathname, API);
    if (url.origin !== API) throw new Error('CNB confirmation URL must use the CNB API origin.');
    const retryable =
      method === 'GET' || method === 'PATCH' || url.pathname.endsWith('/asset-upload-url');
    const operation = url.pathname.includes('/asset-upload-confirmation/')
      ? 'upload confirmation'
      : url.pathname.endsWith('/asset-upload-url')
        ? 'upload URL'
        : 'release';
    for (let attempt = 1; ; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(url.href, {
          method,
          headers: {
            Accept: 'application/vnd.cnb.api+json',
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(60_000),
        });
      } catch (error) {
        if (retryable && attempt < 3) {
          await delay(attempt * 250);
          continue;
        }
        const code = error.cause?.code || error.name;
        throw new Error(`CNB API ${method} ${operation} request failed (${code}).`);
      }
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) {
        if (retryable && attempt < 3 && (response.status === 429 || response.status >= 500)) {
          await response.text();
          await delay(attempt * 250);
          continue;
        }
        throw Object.assign(
          new Error(`CNB API ${method} ${operation} failed (HTTP ${response.status}).`),
          { status: response.status },
        );
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
  };
}

async function uploadAsset(request, fetchImpl, releasePath, asset) {
  // A new signed URL is needed on each retry; never log signed URLs or response bodies.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const urls = await request('POST', `${releasePath}/asset-upload-url`, {
      asset_name: asset.name,
      size: asset.size,
      overwrite: true,
      ttl: 0,
    });
    const upload = new URL(urls.upload_url);
    const verify = new URL(urls.verify_url, API);
    if (
      upload.protocol !== 'https:' ||
      verify.origin !== API ||
      !verify.pathname.startsWith(`${releasePath}/asset-upload-confirmation/`)
    ) {
      throw new Error('CNB returned an invalid asset upload URL.');
    }
    const stream = createReadStream(asset.filename);
    try {
      const response = await fetchImpl(upload.href, {
        method: 'PUT',
        body: stream,
        duplex: 'half',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(asset.size),
        },
        signal: AbortSignal.timeout(15 * 60_000),
      });
      if (!response.ok) throw new Error('Upload failed.');
      await response.arrayBuffer();
      verify.searchParams.set('ttl', '0');
      await request('POST', verify.href);
      return;
    } catch {
      if (attempt === 3) throw new Error(`CNB upload failed after 3 attempts: ${asset.name}`);
    } finally {
      stream.destroy();
      await finished(stream).catch(() => {});
    }
  }
}

async function verifyPublicAssets(fetchImpl, repository, tag, assets) {
  for (const asset of assets) {
    const url = `https://cnb.cool/${repository}/-/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
    let response;
    try {
      // No bearer token: the links in the release notes must work for anonymous users.
      response = await fetchImpl(url, { signal: AbortSignal.timeout(15 * 60_000) });
      if (!response.ok || !response.body) throw new Error('Download unavailable.');
      const hash = createHash('sha256');
      let size = 0;
      for await (const chunk of response.body) {
        hash.update(chunk);
        size += chunk.length;
      }
      if (size !== asset.size || hash.digest('hex') !== asset.sha256) {
        throw new Error('Checksum mismatch.');
      }
    } catch {
      throw new Error(`CNB public download verification failed: ${asset.name}`);
    }
  }
}

async function mirrorRelease({
  repository,
  token,
  tag,
  source,
  commit,
  assets,
  fetchImpl = fetch,
}) {
  validateRepository(repository);
  const metadata = parseReleaseTag(tag);
  if (source.isDraft || source.tagName !== tag || source.isPrerelease !== metadata.prerelease) {
    throw new Error(
      'Only published GitHub installer releases with matching metadata can be mirrored.',
    );
  }
  const request = createClient(token, fetchImpl);
  const repoPath = `/${repository}/-/releases`;
  let release = await request(
    'GET',
    `${repoPath}/tags/${encodeURIComponent(tag)}`,
    undefined,
    true,
  );
  for (let attempt = 1; !release; attempt += 1) {
    try {
      release = await request('POST', repoPath, {
        tag_name: tag,
        target_commitish: commit,
        name: source.name || tag,
        body: `${withoutMirrorNotes(source.body)}\n\n[GitHub Release](${source.url})`,
        draft: true,
        prerelease: metadata.prerelease,
        make_latest: 'false',
      });
      if (!release?.id) throw new Error('CNB did not return the created release metadata.');
    } catch (error) {
      // A connection can close after CNB has accepted the creation request.
      // Reconcile by tag before retrying so an ambiguous result cannot create duplicates.
      release = await request(
        'GET',
        `${repoPath}/tags/${encodeURIComponent(tag)}`,
        undefined,
        true,
      );
      if (
        !release &&
        (attempt === 3 || (error.status && error.status < 500 && error.status !== 409))
      )
        throw error;
    }
  }
  if (release.tag_name !== tag || !release.id)
    throw new Error('CNB returned an unexpected release.');
  const releasePath = `${repoPath}/${encodeURIComponent(release.id)}`;
  if (release.draft) {
    for (const asset of assets) await uploadAsset(request, fetchImpl, releasePath, asset);
    const uploaded = await request('GET', releasePath);
    for (const asset of assets) {
      if (
        !uploaded.assets?.some((remote) => remote.name === asset.name && remote.size === asset.size)
      ) {
        throw new Error(`CNB asset is missing or incomplete: ${asset.name}`);
      }
    }
    let makeLatest = 'false';
    if (!metadata.prerelease) {
      const latest = await request('GET', `${repoPath}/latest`, undefined, true);
      const latestVersion = latest?.tag_name?.slice(1);
      if (!valid(latestVersion) || gt(tag.slice(1), latestVersion)) makeLatest = 'true';
    }
    await request('PATCH', releasePath, {
      draft: false,
      prerelease: metadata.prerelease,
      make_latest: makeLatest,
    });
  } else if (release.prerelease !== metadata.prerelease) {
    throw new Error('Published CNB release metadata does not match GitHub.');
  }
  // Published assets remain immutable, including on retries after a GitHub notes update failure.
  await verifyPublicAssets(fetchImpl, repository, tag, assets);
  return `https://cnb.cool/${repository}/-/releases/tag/${encodeURIComponent(tag)}`;
}

async function main(env = process.env, { run = execFileSync, fetchImpl = fetch } = {}) {
  const repository = validateRepository(env.CNB_REPO);
  const tag = env.RELEASE_TAG;
  assetNames(tag);
  if (!env.CNB_TOKEN) throw new Error('CNB_TOKEN is required. Add it as a GitHub Actions secret.');
  const githubRepository = env.GITHUB_REPOSITORY || 'lonzzi/nekofin';
  const gh = (...args) => run('gh', [...args, '--repo', githubRepository], { encoding: 'utf8' });
  const readSource = () =>
    JSON.parse(gh('release', 'view', tag, '--json', 'tagName,name,body,isDraft,isPrerelease,url'));
  const source = readSource();
  if (source.isDraft) throw new Error('The GitHub Release must be published before mirroring.');
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-cnb-'));
  try {
    console.log(`Downloading and checking GitHub assets for ${tag}...`);
    gh(
      'release',
      'download',
      tag,
      '--dir',
      directory,
      ...assetNames(tag).flatMap((name) => ['--pattern', name]),
    );
    const assets = await validateAssets(directory, tag);
    console.log(`Syncing the source tag and installer release to CNB for ${tag}...`);
    const commit = syncGitTag(repository, env.CNB_TOKEN, tag, { run, env });
    const url = await mirrorRelease({
      repository,
      token: env.CNB_TOKEN,
      tag,
      source,
      commit,
      assets,
      fetchImpl,
    });
    // Read again to preserve edits made while large installers were being mirrored.
    const current = readSource();
    const notes = withMirrorNotes(current.body, repository, tag);
    if (notes !== current.body) {
      const filename = path.join(directory, 'release-notes.md');
      writeFileSync(filename, notes);
      gh('release', 'edit', tag, '--notes-file', filename);
    }
    console.log(`CNB release verified and linked: ${url}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function syncGitTag(repository, token, tag, { run = execFileSync, env = process.env } = {}) {
  validateRepository(repository);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,160}$/.test(tag)) throw new Error('Invalid artifact tag');
  // Tag-triggered checkout can replace an annotated tag with a lightweight local ref.
  // Restore GitHub's tag object locally; the CNB push below must remain unforced.
  run('git', ['fetch', '--no-tags', 'origin', `+refs/tags/${tag}:refs/tags/${tag}`], {
    stdio: 'pipe',
  });
  const commit = run('git', ['rev-parse', `refs/tags/${tag}^{commit}`], {
    encoding: 'utf8',
  }).trim();
  const authorization = Buffer.from(`cnb:${token}`).toString('base64');
  try {
    run(
      'git',
      ['push', `https://cnb.cool/${repository}.git`, `refs/tags/${tag}:refs/tags/${tag}`],
      {
        stdio: 'pipe',
        env: {
          ...env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'http.https://cnb.cool/.extraHeader',
          GIT_CONFIG_VALUE_0: `Authorization: Basic ${authorization}`,
        },
      },
    );
  } catch {
    throw new Error(
      'Could not push the release tag to CNB. Check repo-code permission and existing tags.',
    );
  }
  return commit;
}

module.exports = {
  assetNames,
  createClient,
  main,
  mirrorRelease,
  validateAssets,
  validateRepository,
  withMirrorNotes,
  withoutMirrorNotes,
  syncGitTag,
  uploadAsset,
  verifyPublicAssets,
};
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
