import { prerelease } from 'semver';

export type IosUpdateTool = 'altstore' | 'livecontainer';
const ROOT = 'https://github.com/lonzzi/nekofin/releases/download/app-sources';

export function getIosUpdateSource(currentVersion: string | null) {
  const channel = currentVersion && prerelease(currentVersion)?.length ? 'beta' : 'stable';
  return `${ROOT}/${channel}.json`;
}

export function getIosSourceLink(tool: IosUpdateTool, currentVersion: string | null) {
  return `${tool}://source?url=${encodeURIComponent(getIosUpdateSource(currentVersion))}`;
}
