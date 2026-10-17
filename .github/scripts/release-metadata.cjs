const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');

// SemVer identifiers reject leading zeroes in numeric prerelease components.
const number = '(0|[1-9]\\d*)';
const identifier = '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)';
const tagPattern = new RegExp(
  `^v${number}\\.${number}\\.${number}(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?$`,
);

function parseReleaseTag(tag) {
  const match = tagPattern.exec(tag);
  if (!match || match[0] !== tag) {
    throw new Error(`Invalid release tag "${tag}". Use vX.Y.Z or vX.Y.Z-beta.1 / vX.Y.Z-rc.1.`);
  }

  const version = `${match[1]}.${match[2]}.${match[3]}`;
  return { tag, version, prerelease: Boolean(match[4]) };
}

function getReleaseMetadata(tag, appVersion) {
  const metadata = parseReleaseTag(tag);
  // Expo uses package.json's version as iOS CFBundleShortVersionString.
  // Keep it numeric; the tag and asset names carry the prerelease suffix.
  if (appVersion !== metadata.version) {
    throw new Error(
      `Tag "${tag}" requires package.json version "${metadata.version}"; found "${appVersion}".`,
    );
  }

  return metadata;
}

module.exports = { getReleaseMetadata, parseReleaseTag };

if (require.main === module) {
  try {
    const [, , tag, flag, ...extra] = process.argv;
    if ((flag !== undefined && flag !== '--write-version') || extra.length) {
      throw new Error('Usage: release-metadata.cjs TAG [--write-version]');
    }
    const appPackage = JSON.parse(readFileSync('package.json', 'utf8'));
    // Validate the entire tag before changing any file or GitHub output.
    const metadata =
      flag === '--write-version'
        ? parseReleaseTag(tag)
        : getReleaseMetadata(tag, appPackage.version);
    if (flag === '--write-version' && appPackage.version !== metadata.version) {
      appPackage.version = metadata.version;
      writeFileSync('package.json', JSON.stringify(appPackage, null, 2) + '\n');
    }
    const output = Object.entries(metadata)
      .map(([key, value]) => `${key}=${value}\n`)
      .join('');
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, output);
    }
    process.stdout.write(output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
