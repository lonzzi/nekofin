import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { assertCompatibleRuntime } from './publish.mjs';
import { resolveRuntimes } from './runtime.mjs';

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

test('tag-driven installer and OTA checkouts share a runtime while native changes stay blocked', async (t) => {
  const root = process.cwd();
  const directory = mkdtempSync(path.join(tmpdir(), 'nekofin-tag-runtime-'));
  const environmentKeys = ['APP_VARIANT', 'NEKOFIN_RELEASE_TAG', 'NEKOFIN_OTA_URL'];
  const previousEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  t.after(() => {
    rmSync(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.APP_VARIANT = 'production';
  process.env.NEKOFIN_RELEASE_TAG = 'v9.8.7-beta.1';
  delete process.env.NEKOFIN_OTA_URL;

  function checkout(name, oldVersion) {
    const project = path.join(directory, name);
    mkdirSync(project);
    for (const file of [
      'package.json',
      'bun.lock',
      '.gitignore',
      'app.config.ts',
      'fingerprint.config.js',
      'eas.json',
      'config',
      'plugins',
      'modules',
      'patches',
      'assets',
    ]) {
      cpSync(path.join(root, file), path.join(project, file), {
        recursive: true,
        filter: (source) =>
          !['build', '.gradle', 'Pods', 'node_modules'].includes(path.basename(source)),
      });
    }
    mkdirSync(path.join(project, 'updates/server'), { recursive: true });
    cpSync(
      path.join(root, 'updates/server/ota-certificate.crt'),
      path.join(project, 'updates/server/ota-certificate.crt'),
    );
    symlinkSync(path.join(root, 'node_modules'), path.join(project, 'node_modules'), 'dir');
    const packagePath = path.join(project, 'package.json');
    const appPackage = JSON.parse(readFileSync(packagePath, 'utf8'));
    writeFileSync(
      packagePath,
      JSON.stringify({ ...appPackage, version: oldVersion }, null, 2) + '\n',
    );
    execFileSync(
      process.execPath,
      [
        require.resolve('../../.github/scripts/release-metadata.cjs'),
        process.env.NEKOFIN_RELEASE_TAG,
        '--write-version',
      ],
      { cwd: project, env: { ...process.env, GITHUB_OUTPUT: '' } },
    );
    return project;
  }

  const installer = checkout('installer', '0.1.0');
  const ota = checkout('ota', '0.2.0');
  const { getConfig } = require('expo/config');
  async function inCheckout(project, action) {
    process.chdir(project);
    try {
      return await action();
    } finally {
      process.chdir(root);
    }
  }
  const { exp } = await inCheckout(installer, () => getConfig(installer));
  assert.equal(exp.version, '9.8.7');
  assert.equal(exp.extra.releaseTag, 'v9.8.7-beta.1');
  assert.equal(exp.updates.requestHeaders['expo-channel-name'], 'production-v9.8.7-beta.1');
  const installedRuntime = await inCheckout(installer, () => resolveRuntimes());
  const otaRuntime = await inCheckout(ota, () => resolveRuntimes());
  assert.doesNotThrow(() => assertCompatibleRuntime(installedRuntime, otaRuntime));
  appendFileSync(
    path.join(ota, 'modules/native-layout/ios/NativeLayoutModule.swift'),
    '\n// Native change\n',
  );
  const {
    resolveRuntimeVersionAsync,
  } = require('expo-updates/utils/build/resolveRuntimeVersionAsync.js');
  const changed = await inCheckout(ota, () =>
    resolveRuntimeVersionAsync(ota, 'ios', { silent: true }, { workflowOverride: 'managed' }),
  );
  assert.throws(
    () =>
      assertCompatibleRuntime(installedRuntime, {
        ...otaRuntime,
        runtimes: { ...otaRuntime.runtimes, ios: changed.runtimeVersion },
      }),
    /Native runtime changed/,
  );
});
