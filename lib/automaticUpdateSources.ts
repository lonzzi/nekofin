import { rcompare } from 'semver';

import type { AppRelease } from './appUpdates';
import type { UpdateSource } from './updateSources';

export async function selectAutomaticUpdateSource(
  fetchUpdate: (source: UpdateSource) => Promise<AppRelease | null>,
  sources: readonly UpdateSource[] = ['github', 'cnb'],
) {
  // Requests start together. Record validated response order, including catalog
  // pagination and required checksums, rather than racing unvalidated headers.
  let responseOrder = 0;
  const results = await Promise.allSettled(
    sources.map(async (source) => ({
      source,
      release: await fetchUpdate(source),
      order: responseOrder++,
    })),
  );
  const available = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  if (!available.length) {
    const failed = results.find((result) => result.status === 'rejected');
    throw failed?.reason ?? new Error('No update sources are available');
  }
  available.sort((left, right) => {
    // A fast mirror that has not finished publishing must not hide a newer release.
    if (left.release && right.release) {
      const versionOrder = rcompare(left.release.version, right.release.version);
      if (versionOrder !== 0) return versionOrder;
    } else if (left.release || right.release) {
      return left.release ? -1 : 1;
    }
    return left.order - right.order;
  });
  const { source, release } = available[0];
  return { source, release };
}
