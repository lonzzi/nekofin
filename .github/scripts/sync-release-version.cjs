const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

const { parseReleaseTag } = require('./release-metadata.cjs');

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

function run(args) {
  const result = git(args);
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}

function compareVersions(a, b) {
  const left = a.split('.').map(BigInt);
  const right = b.split('.').map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function syncReleaseVersion(tag, releasedSha) {
  const { version } = parseReleaseTag(tag);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(releasedSha ?? '')) {
    throw new Error('Pass the exact released commit SHA.');
  }
  if (run(['status', '--porcelain'])) throw new Error('Version sync requires a clean checkout.');
  if (run(['rev-parse', '--verify', `${tag}^{commit}`]) !== releasedSha) {
    throw new Error('The release tag moved; refusing to update main.');
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    run(['fetch', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
    const base = run(['rev-parse', 'refs/remotes/origin/main']);
    const ancestor = git(['merge-base', '--is-ancestor', releasedSha, base]);
    if (ancestor.status === 1) {
      console.log('Release commit is not part of main; leaving its version unchanged.');
      return;
    }
    if (ancestor.status !== 0) throw new Error('Cannot verify the release commit ancestry.');

    // Work from the latest main, preserving commits merged while the release was building.
    run(['checkout', '--detach', base]);
    const appPackage = JSON.parse(readFileSync('package.json', 'utf8'));
    const current = parseReleaseTag(`v${appPackage.version}`);
    if (current.version !== appPackage.version) {
      throw new Error('Expected a numeric development version in package.json.');
    }
    if (compareVersions(current.version, version) >= 0) {
      console.log(`main already has version ${current.version}; no version commit needed.`);
      return;
    }
    appPackage.version = version;
    writeFileSync('package.json', JSON.stringify(appPackage, null, 2) + '\n');
    run(['add', '--', 'package.json']);
    run([
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit',
      '-m',
      `chore(release): sync version to ${version}`,
    ]);
    const push = git(['push', 'origin', 'HEAD:refs/heads/main']);
    if (push.status === 0) {
      console.log(`Updated main package.json to ${version} after publishing ${tag}.`);
      return;
    }
    run(['fetch', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
    if (run(['rev-parse', 'refs/remotes/origin/main']) === base) {
      throw new Error(push.stderr || 'Version commit push was rejected.');
    }
  }
  throw new Error('main kept changing during version sync; rerun the version sync job.');
}

module.exports = { syncReleaseVersion };

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: sync-release-version.cjs TAG SHA');
    syncReleaseVersion(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
