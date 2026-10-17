const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.dirname(require.resolve('./package.json'));

// Explicitly cover local native modules and patches in addition to Expo's autolinking sources.
const nativeSources = fs.readdirSync(path.join(projectRoot, 'modules')).flatMap((name) =>
  ['ios', 'android', 'cpp', 'expo-module.config.json']
    .map((directory) => `modules/${name}/${directory}`)
    .filter((filePath) => fs.existsSync(path.join(projectRoot, filePath)))
    .map((filePath) => ({
      type: fs.statSync(path.join(projectRoot, filePath)).isDirectory() ? 'dir' : 'file',
      filePath,
      reasons: ['nekofinNativeRuntime'],
    })),
);

module.exports = {
  extraSources: [
    ...nativeSources,
    { type: 'dir', filePath: 'patches', reasons: ['nekofinNativePatches'] },
    { type: 'dir', filePath: 'plugins', reasons: ['nekofinConfigPlugins'] },
    { type: 'dir', filePath: 'assets/drawables', reasons: ['nekofinCompiledAssets'] },
    { type: 'dir', filePath: 'assets/icons', reasons: ['nekofinCompiledAssets'] },
    {
      type: 'dir',
      filePath: 'node_modules/expo-mpv/plugin',
      reasons: ['nekofinMpvBinaryVersions'],
    },
    {
      type: 'file',
      filePath: 'updates/server/ota-certificate.crt',
      reasons: ['nekofinOtaCertificate'],
    },
  ],
  ignorePaths: [
    '**/build/**',
    '**/.gradle/**',
    '**/Pods/**',
    // Generated downloads are represented by expo-mpv's pinned plugin/Gradle sources.
    '**/node_modules/expo-mpv/ios/Frameworks/**',
    '**/node_modules/expo-mpv/android/src/main/jniLibs/**',
  ],
};
