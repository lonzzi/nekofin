import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

import metadata from '../../.github/scripts/release-metadata.cjs';

export function validateNativeTag(tag, operation, appVersion) {
  if (!['update', 'rollback'].includes(operation)) throw new Error('Unsupported OTA operation');
  const parsed = semver.parse(tag);
  if (!parsed) throw new Error('Invalid native release tag');
  // Restoring an installed binary does not depend on the current branch's native version.
  const expected =
    operation === 'rollback' ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : appVersion;
  return metadata.getReleaseMetadata(tag, expected).tag;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  console.log(validateNativeTag(process.argv[2], process.argv[3] ?? 'update', version));
}
