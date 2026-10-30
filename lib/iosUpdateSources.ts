import { prerelease } from 'semver';

import { getUpdateDownloadURL, type UpdateSource } from './updateSources';

export type IosUpdateTool = 'altstore' | 'livecontainer';
export function getIosUpdateSource(currentVersion: string | null, source: UpdateSource = 'github') {
  const channel = currentVersion && prerelease(currentVersion)?.length ? 'beta' : 'stable';
  return getUpdateDownloadURL(source, 'app-sources', `${channel}.json`);
}

export function getIosSourceLink(
  tool: IosUpdateTool,
  currentVersion: string | null,
  source: UpdateSource = 'github',
) {
  return `${tool}://source?url=${encodeURIComponent(getIosUpdateSource(currentVersion, source))}`;
}
