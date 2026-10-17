import { parse, valid } from 'semver';

export function resolveBuildReleaseTag(appVersion: string, releaseTag: string | undefined) {
  if (!releaseTag) return null;
  const parsed = parse(releaseTag.slice(1));
  if (
    !/^v\d/.test(releaseTag) ||
    releaseTag.trim() !== releaseTag ||
    !valid(releaseTag.slice(1)) ||
    !parsed ||
    `${parsed.major}.${parsed.minor}.${parsed.patch}` !== appVersion
  ) {
    throw new Error(`Release tag "${releaseTag}" must match app version "${appVersion}".`);
  }
  return releaseTag;
}
