import type { MediaApi, MediaServerType, MediaSource } from './types';

export type SubtitleFont = {
  name: string;
  revision: string;
  size?: number;
  url: string;
};
export type FallbackFont = {
  Name: string;
  Size: number;
  DateModified?: string;
};
export const SUBTITLE_FONT_MAX_BYTES = 32 * 1024 * 1024;

export function fontExtension(name: string) {
  return name.match(/\.(ttf|otf|ttc|woff2?)$/i)?.[1].toLowerCase();
}

function apiUrl(api: MediaApi, path: string) {
  try {
    const base = new URL(api.basePath.replace(/\/?$/, '/'));
    const url = new URL(
      path.startsWith(base.pathname) && base.pathname !== '/' ? path : path.replace(/^\//, ''),
      base,
    );
    // Attachment delivery URLs must not send the server's credentials to another host.
    return url.origin === base.origin ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parseFallbackFonts(value: unknown): FallbackFont[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (font): font is FallbackFont =>
        font &&
        typeof font.Name === 'string' &&
        !!fontExtension(font.Name) &&
        !/[\\/]/.test(font.Name) &&
        Number.isFinite(font.Size) &&
        font.Size > 0 &&
        font.Size <= SUBTITLE_FONT_MAX_BYTES &&
        (font.DateModified == null || typeof font.DateModified === 'string'),
    )
    .slice(0, 128);
}

export async function fetchFallbackFonts(api: MediaApi, signal: AbortSignal) {
  const response = await fetch(apiUrl(api, 'FallbackFont/Fonts')!, {
    headers: api.accessToken ? { 'X-Emby-Token': api.accessToken } : {},
    signal,
  });
  if (response.status === 404 || response.status === 204) return [];
  if (!response.ok) throw new Error('Unable to retrieve subtitle fonts');
  return parseFallbackFonts(await response.json());
}

export function deriveSubtitleFonts(
  api: MediaApi,
  type: MediaServerType,
  itemId: string,
  source: MediaSource,
  fallback: FallbackFont[],
): SubtitleFont[] {
  const fonts: SubtitleFont[] = [];
  if (type === 'jellyfin') {
    for (const font of fallback) {
      const url = apiUrl(api, `FallbackFont/Fonts/${encodeURIComponent(font.Name)}`);
      if (url)
        fonts.push({
          name: font.Name,
          size: font.Size,
          revision: JSON.stringify([font.Name, font.Size, font.DateModified ?? null]),
          url,
        });
    }
  }
  for (const attachment of source.mediaAttachments ?? []) {
    if (
      !fontExtension(attachment.fileName) ||
      !Number.isInteger(attachment.index) ||
      attachment.index < 0
    )
      continue;
    const url = apiUrl(
      api,
      attachment.deliveryUrl ??
        `Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(source.id)}/Attachments/${attachment.index}`,
    );
    if (url)
      fonts.push({
        name: attachment.fileName,
        url,
        revision: JSON.stringify([
          itemId,
          source.id,
          source.size ?? null,
          attachment.index,
          attachment.fileName,
        ]),
      });
  }
  return fonts;
}
