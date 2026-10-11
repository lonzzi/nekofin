const languageAliases: Record<string, string[]> = {
  zh: ['zh', 'zho', 'chi', 'cmn'],
  en: ['en', 'eng'],
  ja: ['ja', 'jpn'],
  ko: ['ko', 'kor'],
};
export function preferredTrackId(
  tracks: { id: number; lang?: string }[],
  language: string,
): number | undefined {
  if (!language || language === 'auto') return undefined;
  const aliases = languageAliases[language] ?? [language];
  return tracks.find((track) => aliases.includes((track.lang ?? '').toLowerCase().split(/[-_]/)[0]))
    ?.id;
}
