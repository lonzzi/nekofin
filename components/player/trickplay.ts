import type { TrickplayInfoDto } from '@jellyfin/sdk/lib/generated-client/models';

type TrickplayDimensions = Required<
  Pick<
    TrickplayInfoDto,
    'Width' | 'Height' | 'TileWidth' | 'TileHeight' | 'ThumbnailCount' | 'Interval'
  >
>;

export type TrickplayManifest = TrickplayDimensions & {
  mediaSourceId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Select only the playing media version. Another version can have a different
// timeline, even when its item title is identical.
export function getTrickplayManifest(
  raw: unknown,
  mediaSourceId?: string | null,
): TrickplayManifest | null {
  if (!isRecord(raw) || !isRecord(raw.Trickplay)) return null;
  const sources = raw.Trickplay;
  const sourceId =
    mediaSourceId ??
    (typeof raw.Id === 'string' && raw.Id in sources
      ? raw.Id
      : Object.keys(sources).length === 1
        ? Object.keys(sources)[0]
        : null);
  if (!sourceId || !isRecord(sources[sourceId])) return null;
  const candidates = Object.values(sources[sourceId])
    .filter((value): value is TrickplayDimensions => {
      if (!isRecord(value)) return false;
      return (
        ['Width', 'Height', 'TileWidth', 'TileHeight', 'ThumbnailCount', 'Interval'].every(
          (key) =>
            typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] > 0,
        ) &&
        Number(value.Width) * Number(value.TileWidth) <= 32768 &&
        Number(value.Height) * Number(value.TileHeight) <= 32768
      );
    })
    .sort((a, b) => a.Width - b.Width);
  const info = candidates.find((value) => value.Width >= 176) ?? candidates.at(-1);
  return info ? { ...info, mediaSourceId: sourceId } : null;
}

export function getTrickplayFrame(info: TrickplayManifest, timeMs: number) {
  const index = Math.max(
    0,
    Math.min(
      info.ThumbnailCount - 1,
      Math.floor((Number.isFinite(timeMs) ? timeMs : 0) / info.Interval),
    ),
  );
  const perTile = info.TileWidth * info.TileHeight;
  const tileIndex = Math.floor(index / perTile);
  const position = index % perTile;
  return {
    tileIndex,
    column: position % info.TileWidth,
    row: Math.floor(position / info.TileWidth),
  };
}

export function getTrickplayTileUrl(
  basePath: string,
  itemId: string,
  info: TrickplayManifest,
  tileIndex: number,
) {
  const params = new URLSearchParams({ mediaSourceId: info.mediaSourceId });
  return `${basePath.replace(/\/$/, '')}/Videos/${encodeURIComponent(itemId)}/Trickplay/${info.Width}/${tileIndex}.jpg?${params}`;
}
