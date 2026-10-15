export async function sendPlaybackReport(
  event: 'start' | 'progress' | 'stop',
  report: () => Promise<void>,
) {
  try {
    await report();
  } catch {
    // Reporting is best effort. A timeout must not become an unhandled promise
    // rejection or interrupt playback. Do not log request objects/signed URLs.
    console.info(`[PlaybackSync] ${event} report failed`);
  }
}
