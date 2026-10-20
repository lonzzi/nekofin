const { execFileSync } = require('node:child_process');
const path = require('node:path');

// UIKit loses the outgoing large title on iOS 27 when the app links an older SDK.
// https://github.com/software-mansion/react-native-screens/issues/4663
const minimumSdkMajor = 27;

function assertSdkVersion(version) {
  if (!/^\d+(?:\.\d+){0,2}$/.test(version ?? '')) {
    throw new Error(`Cannot read the iOS build SDK version: ${JSON.stringify(version)}.`);
  }
  if (Number(version.split('.')[0]) < minimumSdkMajor) {
    throw new Error(
      `iOS SDK ${version} is unsupported. Build with Xcode 27 / iOS SDK 27 or newer ` +
        'to preserve large titles during interactive back gestures on iOS 27.',
    );
  }
}

function assertAppMetadata(info) {
  const version = info.DTSDKName?.match(/^iphone(?:os|simulator)(\d+(?:\.\d+){0,2})$/)?.[1];
  assertSdkVersion(version);
  const scenes =
    info.UIApplicationSceneManifest?.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
  if (!Array.isArray(scenes) || !scenes.some((scene) => scene.UISceneDelegateClassName)) {
    throw new Error('iOS 27 builds require the scene lifecycle. Keep enableSceneSupport enabled.');
  }
  return version;
}

function assertMachOSdk(output) {
  const builds = output
    .split(/(?=Load command \d+)/)
    .filter((block) => /^\s+platform (?:IOS|IOSSIMULATOR)\s*$/m.test(block));
  if (!builds.length) {
    throw new Error('Cannot read the linked iOS SDK from the executable LC_BUILD_VERSION.');
  }
  for (const build of builds) {
    assertSdkVersion(build.match(/^\s+sdk (\S+)\s*$/m)?.[1]);
  }
}

function verifyApp(appPath, exec = execFileSync) {
  const options = { encoding: 'utf8' };
  const info = JSON.parse(
    exec('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Info.plist')], options),
  );
  const version = assertAppMetadata(info);
  if (
    !info.CFBundleExecutable ||
    path.basename(info.CFBundleExecutable) !== info.CFBundleExecutable
  ) {
    throw new Error('Cannot read the app executable name from Info.plist.');
  }
  assertMachOSdk(
    exec('xcrun', ['vtool', '-show-build', path.join(appPath, info.CFBundleExecutable)], options),
  );
  return version;
}

module.exports = { assertSdkVersion, assertAppMetadata, assertMachOSdk, verifyApp };

if (require.main === module) {
  try {
    const [, , mode, appPath, ...extra] = process.argv;
    if (mode === '--toolchain' && !appPath) {
      const version = execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-version'], {
        encoding: 'utf8',
      }).trim();
      assertSdkVersion(version);
      console.log(`iOS build SDK verified: ${version}`);
    } else if (mode === '--app' && appPath && !extra.length) {
      console.log(`iOS installer SDK and scene lifecycle verified: ${verifyApp(appPath)}`);
    } else {
      throw new Error('Usage: verify-ios-sdk.cjs --toolchain | --app APP_PATH');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
