import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import type { ExternalPlayerTrack } from './playerTrackLoading';

/** Use the system HTTP/TLS stack, then let mpv read the subtitle locally. */
export function createExternalSubtitleCache() {
  const directory = new Directory(Paths.cache, 'player-subtitles', randomUUID());
  const downloads = new Set<AbortController>();
  let disposed = false;

  const removeDirectory = () => {
    if (directory.exists) directory.delete();
  };

  return {
    async prepare(track: ExternalPlayerTrack, isActive: () => boolean) {
      if (disposed || !isActive()) return;
      directory.create({ intermediates: true, idempotent: true });
      // Never put a signed URL or credentials in a cache filename.
      const extension =
        new URL(track.url).pathname.match(/\.(ass|ssa|srt|vtt|sub|idx|sup|ttml)$/i)?.[1] ?? 'sub';
      const file = new File(directory, `${track.index}-${randomUUID()}.${extension.toLowerCase()}`);
      const controller = new AbortController();
      downloads.add(controller);
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        await File.downloadFileAsync(track.url, file, { signal: controller.signal });
        if (disposed || !isActive()) {
          if (file.exists) file.delete();
          return;
        }
        return { ...track, url: file.uri };
      } catch (error) {
        // Android may leave a partial file after a failed or cancelled download.
        if (file.exists) file.delete();
        if (!disposed && isActive()) throw error;
      } finally {
        clearTimeout(timeout);
        downloads.delete(controller);
        if (disposed) removeDirectory();
      }
    },
    dispose() {
      disposed = true;
      for (const controller of downloads) controller.abort();
      removeDirectory();
    },
  };
}
