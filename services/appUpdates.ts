import { selectAppUpdate, type UpdatePlatform } from '@/lib/appUpdates';

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
        throw new Error('更新服务暂时受限，请稍后再试，或到 GitHub 版本页面查看。');
      }
      if (!response.ok) throw new Error('暂时无法获取版本信息，请稍后重试。');

      const data: unknown = await response.json().catch(() => {
        throw new Error('更新服务返回了无效的版本信息，请稍后重试。');
      });
      if (!Array.isArray(data)) throw new Error('更新服务返回了无效的版本信息，请稍后重试。');
      releases.push(...data);
      if (!response.headers.get('link')?.includes('rel="next"')) {
        return selectAppUpdate(releases, currentVersion, platform);
      }
    }
    throw new Error('版本列表暂时无法完整读取，请到 GitHub 版本页面查看。');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('检查更新超时，请检查网络后重试。');
    if (error instanceof Error && !(error instanceof TypeError)) throw error;
    throw new Error('无法连接更新服务，请检查网络后重试。');
  } finally {
    clearTimeout(timeout);
  }
}
