import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export async function resolveRuntimes(projectRoot = process.cwd()) {
  const { getConfig } = require('expo/config');
  const {
    resolveRuntimeVersionAsync,
  } = require('expo-updates/utils/build/resolveRuntimeVersionAsync.js');
  const { exp } = getConfig(projectRoot);
  if (!exp.updates?.enabled || !exp.updates.url || !exp.updates.codeSigningCertificate) {
    throw new Error('Configure a signed OTA manifest URL before producing release runtimes.');
  }
  const runtimes = {};
  for (const platform of ['ios', 'android']) {
    const result = await resolveRuntimeVersionAsync(
      projectRoot,
      platform,
      { silent: true },
      { workflowOverride: 'managed' },
    );
    if (!/^[a-f0-9]{40,64}$/.test(result.runtimeVersion ?? ''))
      throw new Error('Expected a native fingerprint runtime.');
    runtimes[platform] = result.runtimeVersion;
  }
  return {
    version: 1,
    releaseTag: exp.extra?.releaseTag ?? `v${exp.version}`,
    iosBuildNumber: exp.ios.buildNumber,
    channel: exp.updates.requestHeaders['expo-channel-name'],
    url: exp.updates.url,
    runtimes,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const metadata = await resolveRuntimes();
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(metadata, null, 2) + '\n');
  console.log(JSON.stringify(metadata));
}
