import { gt, parse, rcompare, valid } from 'semver';

export type UpdatePlatform = 'ios' | 'android';

export type AppRelease = {
  tag: string;
  version: string;
  url: string;
  installer: {
    name: string;
    url: string;
    size: number;
    sha256: string | null;
  };
};

export const RELEASES_URL = 'https://github.com/lonzzi/nekofin/releases';
export const AUTO_DOWNLOAD_UPDATES_KEY = 'appUpdate.autoDownload';

export type InstallerDownload = {
  release: AppRelease;
  automatic: boolean;
  status: 'downloading' | 'ready' | 'error';
  progress: number;
  uri?: string;
  waiting?: string;
  error?: string;
};

function isReleaseTag(tag: string) {
  return /^v\d/.test(tag) && tag.trim() === tag && valid(tag.slice(1)) !== null;
}

export function resolveInstalledRelease(nativeVersion: string | null, releaseTag: unknown) {
  const native = nativeVersion ? parse(nativeVersion) : null;
  if (!native) return null;

  if (typeof releaseTag === 'string' && isReleaseTag(releaseTag)) {
    const release = parse(releaseTag.slice(1));
    if (
      release &&
      release.major === native.major &&
      release.minor === native.minor &&
      release.patch === native.patch
    ) {
      return releaseTag.slice(1);
    }
  }

  return native.version;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function selectAppUpdate(
  releases: unknown[],
  currentVersion: string,
  platform: UpdatePlatform,
): AppRelease | null {
  const current = parse(currentVersion);
  if (!current) throw new Error('无法读取当前应用版本，请重新安装正式发布的安装包。');
  const acceptsPrerelease = current.prerelease.length > 0;
  const extension = platform === 'ios' ? 'ios-unsigned.ipa' : 'android-arm64.apk';
  const candidates: AppRelease[] = [];

  for (const release of releases) {
    if (
      !isRecord(release) ||
      release.draft !== false ||
      typeof release.prerelease !== 'boolean' ||
      typeof release.tag_name !== 'string' ||
      !release.tag_name.startsWith('v') ||
      !Array.isArray(release.assets)
    ) {
      continue;
    }

    const tag = release.tag_name;
    const version = tag.slice(1);
    if (!isReleaseTag(tag)) continue;
    const isPrerelease = parse(version)!.prerelease.length > 0;
    if (release.prerelease !== isPrerelease || (isPrerelease && !acceptsPrerelease)) continue;
    if (!gt(version, currentVersion)) continue;

    const assetName = `nekofin-${tag}-${extension}`;
    const installer = release.assets.find(
      (asset) =>
        isRecord(asset) &&
        asset.name === assetName &&
        asset.state === 'uploaded' &&
        typeof asset.size === 'number' &&
        Number.isSafeInteger(asset.size) &&
        asset.size > 0,
    );
    if (!isRecord(installer)) continue;

    candidates.push({
      tag,
      version,
      url: `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`,
      installer: {
        name: assetName,
        url: `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`,
        size: installer.size as number,
        sha256:
          typeof installer.digest === 'string' && /^sha256:[a-f0-9]{64}$/i.test(installer.digest)
            ? installer.digest.slice(7).toLowerCase()
            : null,
      },
    });
  }

  return candidates.sort((a, b) => rcompare(a.version, b.version))[0] ?? null;
}

export function isUpdatePromptRoute(pathname: string) {
  return !(
    pathname === '/player' ||
    pathname.startsWith('/player/') ||
    pathname === '/player-lab' ||
    pathname.startsWith('/player-lab/')
  );
}
