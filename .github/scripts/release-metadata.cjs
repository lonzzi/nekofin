const { appendFileSync, readFileSync } = require('node:fs');

// SemVer identifiers reject leading zeroes in numeric prerelease components.
const number = '(0|[1-9]\\d*)';
const identifier = '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)';
const tagPattern = new RegExp(
  `^v${number}\\.${number}\\.${number}(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?$`,
);

function getReleaseMetadata(tag, appVersion) {
  const match = tagPattern.exec(tag);
  if (!match || match[0] !== tag) {
    throw new Error(`Invalid release tag "${tag}". Use vX.Y.Z or vX.Y.Z-beta.1 / vX.Y.Z-rc.1.`);
  }

  const version = `${match[1]}.${match[2]}.${match[3]}`;
  // Expo uses package.json's version as iOS CFBundleShortVersionString.
  // Keep it numeric; the tag and asset names carry the prerelease suffix.
  if (appVersion !== version) {
    throw new Error(
      `Tag "${tag}" requires package.json version "${version}"; found "${appVersion}".`,
    );
  }

  return { tag, version, prerelease: Boolean(match[4]) };
}

module.exports = { getReleaseMetadata };

if (require.main === module) {
  try {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    const metadata = getReleaseMetadata(process.argv[2], version);
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
