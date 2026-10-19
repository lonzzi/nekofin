import { parse, valid } from 'semver';

export function resolveIosBuildNumber(value: string | undefined) {
  const number = value || '1';
  if (!/^[1-9]\d{0,3}(?:\.(?:0|[1-9]\d?)){0,2}$/.test(number)) {
    throw new Error('NEKOFIN_IOS_BUILD_NUMBER must be a valid numeric iOS build number.');
  }
  return number;
}

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
