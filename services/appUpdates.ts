import { selectAppUpdate, type UpdatePlatform } from '@/lib/appUpdates';
import { t as tr } from '@/lib/i18n';
import { getUpdateDownloadURL, UPDATE_SOURCES, type UpdateSource } from '@/lib/updateSources';

const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchAppUpdate(
  currentVersion: string,
  platform: UpdatePlatform,
  source: UpdateSource = 'github',
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const releases: unknown[] = [];
  const provider = UPDATE_SOURCES[source];

  async function select() {
    const release = selectAppUpdate(releases, currentVersion, platform, source);
    if (!release || source !== 'cnb' || release.installer.sha256) return release;
    const response = await fetch(getUpdateDownloadURL(source, release.tag, 'SHA256SUMS'), {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(tr('updates.versionUnavailable'));
    const text = await response.text();
    if (text.length > 64_000) throw new Error(tr('updates.invalidVersionResponse'));
    const entries = text
      .trim()
      .split(/\r?\n/)
      .map((line) => /^([a-f0-9]{64}) [ *](?:\.\/)?([^/]+)$/i.exec(line));
    const matches = entries.filter((entry) => entry?.[2] === release.installer.name);
    if (entries.some((entry) => !entry) || matches.length !== 1)
      throw new Error(tr('updates.invalidVersionResponse'));
    return {
      ...release,
      installer: { ...release.installer, sha256: matches[0]![1].toLowerCase() },
    };
  }

  try {
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(
        `${provider.api}?${source === 'cnb' ? 'page_size' : 'per_page'}=100&page=${page}`,
        {
          headers: { Accept: provider.accept },
          signal: controller.signal,
        },
      );
      if (response.status === 403 || response.status === 429) {
        throw new Error(tr('updates.serviceRateLimited'));
      }
      if (!response.ok) throw new Error(tr('updates.versionUnavailable'));

      const data: unknown = await response.json().catch(() => {
        throw new Error(tr('updates.invalidVersionResponse'));
      });
      if (!Array.isArray(data)) throw new Error(tr('updates.invalidVersionResponse'));
      releases.push(...data);
      const total = response.headers.get('x-cnb-total');
      const hasNext =
        source === 'github'
          ? response.headers.get('link')?.includes('rel="next"')
          : total && /^\d+$/.test(total)
            ? page * 100 < Number(total)
            : data.length === 100;
      if (!hasNext) {
        return await select();
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
