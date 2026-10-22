import { selectAppUpdate, type UpdatePlatform } from '@/lib/appUpdates';
import { t as tr } from '@/lib/i18n';

const RELEASES_API = 'https://api.github.com/repos/lonzzi/nekofin/releases';
const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchAppUpdate(currentVersion: string, platform: UpdatePlatform) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const releases: unknown[] = [];

  try {
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(`${RELEASES_API}?per_page=100&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (response.status === 403 || response.status === 429) {
        throw new Error(tr('updates.serviceRateLimited'));
      }
      if (!response.ok) throw new Error(tr('updates.versionUnavailable'));

      const data: unknown = await response.json().catch(() => {
        throw new Error(tr('updates.invalidVersionResponse'));
      });
      if (!Array.isArray(data)) throw new Error(tr('updates.invalidVersionResponse'));
      releases.push(...data);
      if (!response.headers.get('link')?.includes('rel="next"')) {
        return selectAppUpdate(releases, currentVersion, platform);
      }
    }
    throw new Error(tr('updates.releaseListUnavailable'));
  } catch (error) {
    if (controller.signal.aborted) throw new Error(tr('updates.checkTimedOut'));
    if (error instanceof Error && !(error instanceof TypeError)) throw error;
    throw new Error(tr('updates.serviceUnreachable'));
  } finally {
    clearTimeout(timeout);
  }
}
