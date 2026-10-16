import type { ApiClient } from '@/lib/request';

export type EmbyThumbnail = { PositionTicks: number; ImageTag: string };
export type EmbyThumbnailSet = { AspectRatio?: number; Thumbnails: EmbyThumbnail[] };

export function parseEmbyThumbnailSet(payload: unknown): EmbyThumbnailSet {
  if (!payload || typeof payload !== 'object') return { Thumbnails: [] };
  const raw = payload as Record<string, unknown>;
  const thumbnails = Array.isArray(raw.Thumbnails)
    ? raw.Thumbnails.filter(
        (value): value is EmbyThumbnail =>
          value &&
          typeof value === 'object' &&
          Number.isSafeInteger(value.PositionTicks) &&
          value.PositionTicks >= 0 &&
          typeof value.ImageTag === 'string' &&
          value.ImageTag.length > 0,
      ).sort((a, b) => a.PositionTicks - b.PositionTicks)
    : [];
  return {
    AspectRatio:
      typeof raw.AspectRatio === 'number' && Number.isFinite(raw.AspectRatio) && raw.AspectRatio > 0
        ? raw.AspectRatio
        : undefined,
    Thumbnails: thumbnails,
  };
}

export async function getEmbyThumbnailSet(
  client: ApiClient,
  itemId: string,
  mediaSourceId?: string | null,
  signal?: AbortSignal,
) {
  const result = await client.get<unknown>(
    `/Items/${encodeURIComponent(itemId)}/ThumbnailSet`,
    { Width: 320, MediaSourceId: mediaSourceId ?? undefined },
    { signal },
  );
  return parseEmbyThumbnailSet(result.data);
}

export function getEmbyThumbnail(set: EmbyThumbnailSet, timeMs: number) {
  const ticks = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0) * 10000;
  let low = 0;
  let high = set.Thumbnails.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (set.Thumbnails[mid].PositionTicks <= ticks) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found >= 0 ? set.Thumbnails[found] : null;
}

export function getEmbyThumbnailUrl(
  basePath: string,
  itemId: string,
  thumbnail: EmbyThumbnail,
  mediaSourceId?: string | null,
) {
  const params = new URLSearchParams({
    MaxWidth: '320',
    tag: thumbnail.ImageTag,
    PositionTicks: String(thumbnail.PositionTicks),
  });
  if (mediaSourceId) params.set('MediaSourceId', mediaSourceId);
  return `${basePath.replace(/\/$/, '')}/Items/${encodeURIComponent(itemId)}/Images/Thumbnail?${params}`;
}
