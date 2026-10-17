import type { RawMediaStream } from './mappers';

export function prioritizeSubtitleTracks<T extends { index: number }>(
  tracks: T[],
  preferredIndex?: number,
) {
  return [...tracks].sort(
    (a, b) => Number(b.index === preferredIndex) - Number(a.index === preferredIndex),
  );
}

type ExternalTrackContext = {
  itemId?: string;
  mediaSourceId?: string | null;
  accessToken?: string | null;
};

function resolveTrackUrl(path: string, basePath?: string, accessToken?: string | null) {
  try {
    const base = basePath ? new URL(basePath.replace(/\/$/, '') + '/') : undefined;
    // DeliveryUrl can be absolute, API-relative, or include the reverse proxy prefix.
    const url = new URL(
      /^https?:\/\//i.test(path)
        ? path
        : base && base.pathname !== '/' && path.startsWith(base.pathname)
          ? path
          : path.replace(/^\//, ''),
      base && base.pathname !== '/' && path.startsWith(base.pathname) ? base.origin : base,
    );
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (accessToken && base?.origin === url.origin && !url.searchParams.has('api_key')) {
      url.searchParams.set('api_key', accessToken);
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function deriveExternalSubtitles(
  mediaStreams: RawMediaStream[] = [],
  basePath?: string,
  context: ExternalTrackContext = {},
) {
  return mediaStreams
    .filter(
      (sub) =>
        sub.Type === 'Subtitle' &&
        sub.DeliveryMethod !== 'Encode' &&
        (sub.IsExternal || sub.DeliveryMethod === 'External'),
    )
    .flatMap((sub) => {
      const format = { subrip: 'srt', webvtt: 'vtt' }[sub.Codec ?? ''] ?? sub.Codec;
      const path =
        sub.DeliveryUrl ||
        (context.itemId && context.mediaSourceId && sub.Index != null && format
          ? `/Videos/${encodeURIComponent(context.itemId)}/${encodeURIComponent(context.mediaSourceId)}/Subtitles/${sub.Index}/0/Stream.${encodeURIComponent(format)}`
          : null);
      const url = path ? resolveTrackUrl(path, basePath, context.accessToken) : null;
      if (!url) return [];
      return [
        {
          index: sub.Index ?? 0,
          name: sub.DisplayTitle ?? sub.Language ?? '',
          language: sub.Language ?? undefined,
          url,
        },
      ];
    });
}

export function deriveExternalAudio(
  mediaStreams: RawMediaStream[] = [],
  basePath?: string,
  context: ExternalTrackContext = {},
) {
  return mediaStreams
    .filter((audio) => audio.Type === 'Audio' && audio.DeliveryMethod === 'External')
    .filter((audio) => !!audio.DeliveryUrl)
    .flatMap((audio) => {
      const url = resolveTrackUrl(audio.DeliveryUrl!, basePath, context.accessToken);
      return url
        ? [
            {
              index: audio.Index ?? 0,
              name: audio.DisplayTitle ?? audio.Language ?? '',
              language: audio.Language ?? undefined,
              url,
            },
          ]
        : [];
    });
}
