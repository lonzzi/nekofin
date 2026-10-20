const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  assertSdkVersion,
  assertAppMetadata,
  assertMachOSdk,
  verifyApp,
} = require('./verify-ios-sdk.cjs');

const appInfo = {
  CFBundleExecutable: 'nekofin',
  DTSDKName: 'iphoneos27.0',
  UIApplicationSceneManifest: {
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [{ UISceneDelegateClassName: 'EXExpoAppSceneDelegate' }],
    },
  },
};

const buildCommand = (sdk, platform = 'IOS') => `Load command 22
      cmd LC_BUILD_VERSION
  cmdsize 32
 platform ${platform}
    minos 16.4
      sdk ${sdk}
   ntools 1`;

test('rejects SDK 26 builds that lose large titles on iOS 27, while allowing newer SDKs', () => {
  for (const version of ['16.4', '26.0', '26.5', '26.6.1']) {
    assert.throws(() => assertSdkVersion(version), /preserve large titles/);
  }
  for (const version of ['27', '27.0', '27.1.2', '28.0']) {
    assert.doesNotThrow(() => assertSdkVersion(version));
  }
  for (const version of [undefined, '', 'unknown', '27beta', '27.0\n']) {
    assert.throws(() => assertSdkVersion(version), /Cannot read/);
  }
});

test('checks the compiled SDK without raising the app minimum supported iOS version', () => {
  assert.equal(assertAppMetadata({ ...appInfo, MinimumOSVersion: '16.4' }), '27.0');
  assert.equal(assertAppMetadata({ ...appInfo, DTSDKName: 'iphonesimulator27.0' }), '27.0');
  assert.throws(() => assertAppMetadata({ ...appInfo, DTSDKName: 'iphoneos26.5' }), /SDK 26.5/);
  assert.throws(() => assertAppMetadata({ ...appInfo, DTSDKName: 'macosx27.0' }), /Cannot read/);
});

test('rejects SDK 27 apps without a scene delegate instead of producing an app that cannot launch', () => {
  for (const manifest of [
    undefined,
    {},
    { UISceneConfigurations: {} },
    {
      UISceneConfigurations: { UIWindowSceneSessionRoleApplication: [{}] },
    },
  ]) {
    assert.throws(
      () => assertAppMetadata({ ...appInfo, UIApplicationSceneManifest: manifest }),
      /scene lifecycle/,
    );
  }
});

test('validates every iOS Mach-O slice and rejects missing or non-iOS build commands', () => {
  assert.doesNotThrow(() => assertMachOSdk(buildCommand('27.0')));
  assert.doesNotThrow(() => assertMachOSdk(buildCommand('27.0', 'IOSSIMULATOR')));
  assert.throws(() => assertMachOSdk(buildCommand('26.5')), /SDK 26.5/);
  assert.throws(
    () => assertMachOSdk(`${buildCommand('27.0')}\n${buildCommand('26.5')}`),
    /SDK 26.5/,
  );
  for (const output of ['', buildCommand('27.0', 'MACOS'), buildCommand('n/a')]) {
    assert.throws(() => assertMachOSdk(output), /Cannot read/);
  }
});

test('rejects an executable linked to SDK 26 even when Info.plist claims SDK 27', () => {
  const exec = (command) => (command === 'plutil' ? JSON.stringify(appInfo) : buildCommand('26.5'));
  assert.throws(() => verifyApp('/tmp/nekofin.app', exec), /SDK 26.5/);
});

test('accepts a scene-enabled app whose metadata and linked executable both use SDK 27', () => {
  const exec = (command) => (command === 'plutil' ? JSON.stringify(appInfo) : buildCommand('27.0'));
  assert.equal(verifyApp('/tmp/nekofin.app', exec), '27.0');
});
