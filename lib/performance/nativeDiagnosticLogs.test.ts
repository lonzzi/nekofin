import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readNativeDiagnosticLogs } from './nativeDiagnosticLogs';

const state = vi.hoisted(() => ({
  module: null as null | { readOwnLogAsync: () => Promise<string> },
  platform: 'android',
}));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => state.module }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

describe('optional own-process Android logs', () => {
  beforeEach(() => {
    state.platform = 'android';
    state.module = null;
  });

  it('includes native decoder errors while redacting signed URLs and authorization', async () => {
    state.module = {
      readOwnLogAsync: async () =>
        'ExpoMpv: mediacodec initialized\nHTTP failed https://media.test/stream?api_key=native-secret\nToken="header-secret"',
    };
    const text = await readNativeDiagnosticLogs();
    expect(text).toContain('mediacodec initialized');
    expect(text).not.toContain('native-secret');
    expect(text).not.toContain('header-secret');
  });

  it('explains unsupported builds and native failures without losing the rest of the export', async () => {
    expect(await readNativeDiagnosticLogs()).toContain('rebuild');
    state.module = {
      readOwnLogAsync: async () => {
        throw new Error('permission denied');
      },
    };
    expect(await readNativeDiagnosticLogs()).toContain('permission denied');
    state.platform = 'ios';
    expect(await readNativeDiagnosticLogs()).toContain('available on Android');
  });
});
