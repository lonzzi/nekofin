const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

function parseAndroidRuntime(manifest, resources) {
  const metadata = manifest
    .split(/\n\s*E: /)
    .find((block) => block.includes('"expo.modules.updates.EXPO_RUNTIME_VERSION"'));
  const value = metadata?.match(/A: android:value[^=\n]*=(.+)/)?.[1].trim();
  const literal = value?.match(/^"([^"]+)"/)?.[1];
  if (literal) return literal;
  const reference = value?.match(/^@(0x[0-9a-f]+)/i)?.[1];
  if (reference) {
    const entry = new RegExp(
      `^\\s*resource ${reference}[^\\n]*\\n\\s*\\(string(?:8|16)?\\)\\s+"([^"]+)"`,
      'm',
    );
    const runtime = resources.match(entry)?.[1];
    if (runtime) return runtime;
  }
  throw new Error('Cannot read the Android native runtime from the compiled manifest/resources.');
}

function resolveRuntimeValue(value, readFingerprint) {
  return value === 'file:fingerprint' ? readFingerprint().trim() : value;
}

function assertRuntime(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Installer runtime "${actual}" does not match release runtime "${expected}".`);
  }
}

module.exports = { parseAndroidRuntime, resolveRuntimeValue, assertRuntime };

if (require.main === module) {
  try {
    const [, , platform, artifact, expected, ...extra] = process.argv;
    if (
      !['android', 'ios'].includes(platform) ||
      !artifact ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expected ?? '') ||
      extra.length
    ) {
      throw new Error('Usage: verify-native-runtime.cjs android|ios APK_OR_APP EXPECTED_RUNTIME');
    }
    let actual;
    if (platform === 'ios') {
      const value = execFileSync(
        'plutil',
        [
          '-extract',
          'EXUpdatesRuntimeVersion',
          'raw',
          '-o',
          '-',
          path.join(artifact, 'Expo.plist'),
        ],
        { encoding: 'utf8' },
      ).trim();
      actual = resolveRuntimeValue(value, () =>
        readFileSync(path.join(artifact, 'EXUpdates.bundle', 'fingerprint'), 'utf8'),
      );
    } else {
      const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
      if (!sdk) throw new Error('Set ANDROID_SDK_ROOT or ANDROID_HOME to find aapt.');
      const tools = path.join(sdk, 'build-tools');
      const version = readdirSync(tools)
        .filter((entry) => existsSync(path.join(tools, entry, 'aapt')))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
      if (!version) throw new Error('Android build-tools/aapt is missing.');
      const aapt = path.join(tools, version, 'aapt');
      const options = { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 };
      const manifest = execFileSync(
        aapt,
        ['dump', 'xmltree', artifact, 'AndroidManifest.xml'],
        options,
      );
      const resources = execFileSync(aapt, ['dump', '--values', 'resources', artifact], options);
      actual = resolveRuntimeValue(parseAndroidRuntime(manifest, resources), () =>
        execFileSync('unzip', ['-p', artifact, 'assets/fingerprint'], options),
      );
    }
    assertRuntime(actual, expected);
    console.log(`${platform} installer runtime verified: ${actual}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
