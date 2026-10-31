import { afterEach, describe, expect, it, vi } from 'vitest';

import { activeDecoderStatus, createPlaybackDiagnosticSampler } from './playbackDiagnostics';

afterEach(() => vi.useRealTimers());

describe('actual video decoder diagnostics', () => {
  it('distinguishes the active decoder from the configured hardware preference', () => {
    expect(activeDecoderStatus({ hwdec: 'mediacodec', hwdecCurrent: 'mediacodec-copy' })).toBe(
      'hardware',
    );
    expect(activeDecoderStatus({ hwdec: 'auto', hwdecCurrent: 'no' })).toBe('software');
    expect(
      activeDecoderStatus({
        hwdec: 'mediacodec',
        hwdecCurrent: '',
        videoCodec: 'h264',
        width: 1920,
      }),
    ).toBe('software');
    expect(activeDecoderStatus({ hwdec: 'mediacodec', hwdecCurrent: '' })).toBe('unknown');
  });
});

describe('bounded native diagnostic sampling', () => {
  it('records a timeout without piling up reads, then recovers when the bridge returns', async () => {
    vi.useFakeTimers();
    let finish!: (value: Record<string, unknown>) => void;
    const read = vi.fn(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          finish = resolve;
        }),
    );
    const record = vi.fn();
    const sample = createPlaybackDiagnosticSampler({
      read,
      record,
      active: () => true,
      timeoutMs: 1000,
    });
    const first = sample();
    expect(sample()).toBe(first);
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledExactlyOnceWith(
      'player.snapshot.timeout',
      { elapsedMs: 1000 },
      'error',
    );
    expect(sample()).toBe(first);
    finish({ native: { hwdecCurrent: 'mediacodec' } });
    await first;
    expect(record).toHaveBeenLastCalledWith('player.snapshot', {
      native: { hwdecCurrent: 'mediacodec' },
      readDurationMs: 5000,
    });
    void sample();
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(2);
    finish({});
  });

  it('discards late results and timeout events after source replacement or disable', async () => {
    vi.useFakeTimers();
    let active = true;
    let finish!: (data: Record<string, unknown>) => void;
    const read = vi.fn(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          finish = resolve;
        }),
    );
    const record = vi.fn();
    const sample = createPlaybackDiagnosticSampler({
      read,
      record,
      active: () => active,
      timeoutMs: 1000,
    });
    const request = sample();
    await Promise.resolve();
    active = false;
    await vi.advanceTimersByTimeAsync(1000);
    finish({ oldSource: true });
    await request;
    expect(record).not.toHaveBeenCalled();
    await sample();
    expect(read).toHaveBeenCalledOnce();
  });

  it('reports native errors and releases the slot for another sample', async () => {
    const record = vi.fn();
    const error = new Error('Native player unavailable');
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ loaded: true });
    const sample = createPlaybackDiagnosticSampler({ read, record, active: () => true });
    await sample();
    expect(record).toHaveBeenCalledWith('player.snapshot.failed', { error }, 'error');
    await sample();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
