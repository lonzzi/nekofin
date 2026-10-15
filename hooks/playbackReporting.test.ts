import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendPlaybackReport } from './playbackReporting';

describe('playback reporting failures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends a successful report once', async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    await sendPlaybackReport('progress', report);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it.each(['start', 'progress', 'stop'] as const)(
    'handles a rejected %s report without exposing credentials or breaking playback',
    async (event) => {
      const log = vi.spyOn(console, 'info').mockImplementation(() => {});
      await expect(
        sendPlaybackReport(event, async () => {
          throw new Error('timeout https://media.test?api_key=secret');
        }),
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(`[PlaybackSync] ${event} report failed`);
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    },
  );

  it('also handles a synchronous adapter failure', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(
      sendPlaybackReport('stop', () => {
        throw new Error('Connection was removed');
      }),
    ).resolves.toBeUndefined();
  });
});
