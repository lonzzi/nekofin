import type { MediaItem, MediaServerInfo, MediaSource, MediaStream } from './types';

export type SubtitlePreference =
  | { mode: 'off' }
  | {
      mode: 'track';
      language?: string;
      title?: string;
      codec?: string;
      forced: boolean;
      external: boolean;
      variant?: string;
    };

export type SubtitlePreferenceScope = {
  server: Pick<MediaServerInfo, 'id' | 'userId'> | null;
  item: Pick<MediaItem, 'id' | 'type' | 'seriesId'> | null | undefined;
};

export function subtitlePreferenceKey({ server, item }: SubtitlePreferenceScope) {
  const id = item?.type === 'Episode' ? item.seriesId : item?.id;
  return server?.id && server.userId && id
    ? `playback.subtitleChoice.${server.id}.${server.userId}.${id}`
    : undefined;
}

const normalized = (value?: string | null) => value?.normalize('NFKC').trim().toLowerCase();
const language = (value?: string | null) => {
  const code = normalized(value)?.split(/[-_]/)[0];
  if (!code || code === 'und') return undefined;
  if (['chi', 'zho', 'cmn'].includes(code ?? '')) return 'zh';
  return ({ eng: 'en', jpn: 'ja', kor: 'ko' } as Record<string, string>)[code ?? ''] ?? code;
};
const variant = (stream: MediaStream) => {
  const label = `${stream.language ?? ''} ${stream.title ?? ''} ${stream.displayTitle ?? ''}`;
  if (/繁[体體]|traditional|hant|(?:^|[._\s-])cht(?:$|[._\s-])/i.test(label)) return 'traditional';
  if (/简[体體]|簡[体體]|simplified|hans|(?:^|[._\s-])chs(?:$|[._\s-])/i.test(label))
    return 'simplified';
  return undefined;
};

export function subtitlePreferenceForIndex(
  source: MediaSource,
  index: number,
): SubtitlePreference | undefined {
  if (index === -1) return { mode: 'off' };
  const track = source.mediaStreams.find(
    (stream) => stream.type === 'Subtitle' && stream.index === index,
  );
  if (!track) return undefined;
  return {
    mode: 'track',
    language: language(track.language),
    title: normalized(track.title || track.displayTitle),
    codec: normalized(track.codec),
    forced: !!track.isForced,
    external: !!track.isExternal,
    variant: variant(track),
  };
}

export function parseSubtitlePreference(value?: string): SubtitlePreference | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.mode === 'off') return { mode: 'off' };
    if (
      parsed?.mode !== 'track' ||
      typeof parsed.forced !== 'boolean' ||
      typeof parsed.external !== 'boolean' ||
      ['language', 'title', 'codec', 'variant'].some(
        (key) => parsed[key] != null && typeof parsed[key] !== 'string',
      )
    )
      return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Match track characteristics, since stream indices change between files. */
export function preferredSubtitleIndex(
  tracks: MediaStream[],
  preference?: SubtitlePreference,
): number | undefined {
  if (!preference) return undefined;
  if (preference.mode === 'off') return -1;
  let best: { index: number; score: number } | undefined;
  for (const track of tracks.filter((entry) => entry.type === 'Subtitle')) {
    const title = normalized(track.title || track.displayTitle);
    const sameTitle = !!preference.title && title === preference.title;
    const trackLanguage = language(track.language);
    if (preference.language && trackLanguage ? trackLanguage !== preference.language : !sameTitle)
      continue;
    const trackVariant = variant(track);
    if (preference.variant && trackVariant && preference.variant !== trackVariant) continue;
    const score =
      (sameTitle ? 16 : 0) +
      (preference.variant && preference.variant === trackVariant ? 8 : 0) +
      (!!track.isForced === preference.forced ? 4 : 0) +
      (normalized(track.codec) === preference.codec ? 2 : 0) +
      (!!track.isExternal === preference.external ? 1 : 0);
    if (!best || score > best.score) best = { index: track.index, score };
  }
  return best?.index;
}
