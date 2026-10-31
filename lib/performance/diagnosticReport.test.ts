import { describe, expect, it } from 'vitest';

import {
  formatDiagnosticReport,
  redactDiagnosticText,
  sanitizeDiagnosticData,
} from './diagnosticReport';

describe('diagnostic privacy and readable report', () => {
  it('redacts nested credentials and signed URLs before they reach storage', () => {
    const result = sanitizeDiagnosticData({
      accessToken: 'account-secret',
      nested: {
        Authorization: 'Bearer bearer-secret',
        api_key: 'query-secret',
        playSessionId: 'session-secret',
      },
      source: 'https://alice:password@media.test/Videos/movie/stream?api_key=url-secret#token',
      error: new Error('HTTP failed https://media.test/sub.srt?api_key=error-secret'),
      tracks: [{ name: 'Chinese', index: 0 }],
    });
    const text = JSON.stringify(result);
    for (const secret of [
      'account-secret',
      'bearer-secret',
      'query-secret',
      'session-secret',
      'url-secret',
      'error-secret',
      'alice',
      'password@',
    ])
      expect(text).not.toContain(secret);
    expect(text).toContain('https://media.test/Videos/movie/stream');
    expect(text).toContain('Chinese');
    expect(redactDiagnosticText('Token="quoted secret" password=pass Bearer abc')).toBe(
      'Token=[redacted] password=[redacted] Bearer [redacted]',
    );
  });

  it('exports device details and an ordered playback timeline as log text', () => {
    const log = formatDiagnosticReport({
      generatedAt: '2026-10-30T15:00:10.000Z',
      environment: {
        device: { model: 'Xiaomi Pad', osVersion: '16', cpuArchitectures: ['arm64-v8a'] },
        application: { expoMpv: '0.1.24' },
      },
      settings: { enabled: true },
      samples: [],
      events: [
        {
          id: '2',
          timestamp: 2000,
          type: 'playback',
          status: 'ok',
          name: 'player.snapshot',
          data: {
            title: 'Episode 2',
            native: { hwdec: 'auto', hwdecCurrent: 'mediacodec', decoderStatus: 'hardware' },
          },
        },
        {
          id: '1',
          timestamp: 1000,
          type: 'playback',
          status: 'pending',
          name: 'subtitle.selection.requested',
          data: { serverIndex: 0 },
        },
      ],
      pendingTraces: [{ name: 'GET https://media.test/stream?api_key=hidden', durationMs: 3000 }],
    });
    expect(log.startsWith('NekoFin diagnostic log\n')).toBe(true);
    expect(log).toContain('device.model: Xiaomi Pad');
    expect(log).toContain('native.hwdecCurrent: mediacodec');
    expect(log).toContain('native.decoderStatus: hardware');
    expect(log).toContain('title: Episode 2');
    expect(log.indexOf('subtitle.selection.requested')).toBeLessThan(
      log.indexOf('player.snapshot'),
    );
    expect(log).not.toContain('hidden');
    expect(() => JSON.parse(log)).toThrow();
  });

  it('explains why an empty capture has no timeline', () => {
    expect(
      formatDiagnosticReport({
        generatedAt: '',
        environment: {},
        settings: { enabled: false },
        samples: [],
        events: [],
      }),
    ).toContain('Enable diagnostics before reproducing');
  });
});
