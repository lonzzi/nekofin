import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('fingerprints build configuration and native sources without capturing client update logic', async () => {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  process.env.APP_VARIANT = 'production';
  process.env.NEKOFIN_RELEASE_TAG = `v${version}`;
  delete process.env.NEKOFIN_OTA_URL;
  const {
    resolveRuntimeVersionAsync,
  } = require('expo-updates/utils/build/resolveRuntimeVersionAsync.js');
  const result = await resolveRuntimeVersionAsync(
    process.cwd(),
    'ios',
    { silent: true },
    { workflowOverride: 'managed' },
  );
  const paths = new Set(result.fingerprintSources.map((source) => source.filePath));
  for (const path of [
    'config/ota.ts',
    'config/release.ts',
    'modules/native-layout/ios',
    'patches',
    'assets/drawables',
  ]) {
    assert.ok(paths.has(path), `Missing native fingerprint source: ${path}`);
  }
  for (const path of ['lib/appUpdates.ts', 'lib/otaConfig.ts', 'hooks/useHotUpdate.ts']) {
    assert.ok(
      !paths.has(path),
      `Client JS changes should not require a new native binary: ${path}`,
    );
  }
});
