import { describe, expect, it } from 'vitest';

import { createPlayerLoadRecovery, playbackFailureMessage } from './playerLoadRecovery';

describe('player load recovery', () => {
  const loadingFailed = 'Playback error: loading failed (code -13)';

  it('allows only one automatic renegotiation even if native emits repeated errors', () => {
    const recovery = createPlayerLoadRecovery();
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1')).toBe(true);
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1')).toBe(false);
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1')).toBe(false);
  });

  it('gives a different playback selection its own retry budget', () => {
    const recovery = createPlayerLoadRecovery();
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1:version-1')).toBe(true);
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1:version-1')).toBe(false);
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1:version-2')).toBe(true);
  });

  it.each([
    'Playback error: audio output initialization failed (code -14)',
    'Playback error: video output initialization failed (code -15)',
    'Playback error: unrecognized file format (code -17)',
    "Command 'sub-add' failed: loading failed",
  ])('does not retry a different failure or consume the loading retry: %s', (error) => {
    const recovery = createPlayerLoadRecovery();
    expect(recovery.claimAutomaticRetry(error, 'episode-1')).toBe(false);
    expect(recovery.claimAutomaticRetry(loadingFailed, 'episode-1')).toBe(true);
  });

  it('shows a useful error code without exposing signed URLs or native log details', () => {
    const message = playbackFailureMessage(
      'https://media.test/stream?api_key=secret Playback error: loading failed (code -13)',
    );
    expect(message).toContain('-13');
    expect(message).toContain('重新加载');
    expect(message).not.toContain('secret');
    expect(message).not.toContain('https://');
  });
});
