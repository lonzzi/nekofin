import { describe, expect, it } from 'vitest';

import { createPlayerAutoNext } from './playerAutoNext';

function completedEpisode() {
  const context = {};
  return {
    completion: { context, reason: 'ended' as const },
    activeContext: context,
    enabled: true,
    itemId: 'episode-1',
    itemType: 'Episode',
    nextEpisodeId: 'episode-2',
  };
}

describe('automatic next episode', () => {
  it('advances exactly once when a playing episode finishes naturally', () => {
    const autoNext = createPlayerAutoNext();
    const playback = completedEpisode();
    expect(autoNext.claim(playback)).toBe('episode-2');
    expect(autoNext.claim(playback)).toBeNull();
    // A rerender with changed next-episode metadata must not skip another episode.
    expect(autoNext.claim({ ...playback, nextEpisodeId: 'episode-3' })).toBeNull();
    expect(autoNext.claim(completedEpisode())).toBe('episode-2');
  });

  it.each(['stopped', 'error', 'unknown'] as const)('never advances after %s', (reason) => {
    const playback = completedEpisode();
    expect(
      createPlayerAutoNext().claim({
        ...playback,
        completion: { ...playback.completion, reason },
      }),
    ).toBeNull();
  });

  it('deduplicates separate EOF state and end-file notifications for the same playback', () => {
    const autoNext = createPlayerAutoNext();
    const playback = completedEpisode();
    expect(autoNext.claim(playback)).toBe('episode-2');
    expect(autoNext.claim({ ...playback, completion: { ...playback.completion } })).toBeNull();
  });

  it('honors the disabled setting without changing manual next-episode availability', () => {
    const playback = completedEpisode();
    expect(createPlayerAutoNext().claim({ ...playback, enabled: false })).toBeNull();
    expect(playback.nextEpisodeId).toBe('episode-2');
  });

  it('ignores late completion events after a source replacement or exit', () => {
    const playback = completedEpisode();
    const autoNext = createPlayerAutoNext();
    expect(autoNext.claim({ ...playback, activeContext: {} })).toBeNull();
    expect(autoNext.claim({ ...playback, activeContext: null })).toBeNull();
    expect(autoNext.claim({ ...playback, completion: null })).toBeNull();
  });

  it('waits for episode metadata and stops at the end of the episode list', () => {
    const playback = completedEpisode();
    const autoNext = createPlayerAutoNext();
    expect(autoNext.claim({ ...playback, itemType: undefined })).toBeNull();
    expect(autoNext.claim({ ...playback, nextEpisodeId: undefined })).toBeNull();
    expect(autoNext.claim(playback)).toBe('episode-2');
  });

  it('does not advance movies or loop to the current episode', () => {
    const playback = completedEpisode();
    const autoNext = createPlayerAutoNext();
    expect(autoNext.claim({ ...playback, itemType: 'Movie' })).toBeNull();
    expect(autoNext.claim({ ...playback, nextEpisodeId: playback.itemId })).toBeNull();
  });
});
