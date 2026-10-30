import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportDiagnosticLog } from './exportDiagnosticLog';

const state = vi.hoisted(() => ({
  write: vi.fn(),
  share: vi.fn(),
  available: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  Directory: class {
    uri = 'file:///cache/nekofin/diagnostics';
    create = state.create;
    list = () => [];
  },
  File: class {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}/${name}`;
    }
    write = state.write;
    delete = state.remove;
  },
}));
vi.mock('expo-sharing', () => ({ isAvailableAsync: state.available, shareAsync: state.share }));
vi.mock('./nativeDiagnosticLogs', () => ({
  readNativeDiagnosticLogs: async () => 'MediaCodec: initialized',
}));

describe('diagnostic file export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.available.mockResolvedValue(true);
    state.share.mockResolvedValue(undefined);
  });

  it('writes a real .log file and shares its URI with text MIME type', async () => {
    const uri = await exportDiagnosticLog('NekoFin diagnostic log\nHello', 'Export log');
    expect(uri).toMatch(/^file:\/\/\/cache\/nekofin\/diagnostics\/nekofin-diagnostics-.*\.log$/);
    expect(state.write).toHaveBeenCalledExactlyOnceWith(
      'NekoFin diagnostic log\nHello\n[Recent native logs: current app process, Android device time]\nMediaCodec: initialized\n',
    );
    expect(state.share).toHaveBeenCalledExactlyOnceWith(uri, {
      mimeType: 'text/plain',
      UTI: 'public.plain-text',
      dialogTitle: 'Export log',
    });
    expect(state.write.mock.invocationCallOrder[0]).toBeLessThan(
      state.share.mock.invocationCallOrder[0],
    );
  });

  it('reports unsupported sharing and file failures instead of pretending to export', async () => {
    state.available.mockResolvedValue(false);
    await expect(exportDiagnosticLog('log', 'Export')).rejects.toThrow('unavailable');
    expect(state.write).not.toHaveBeenCalled();
    state.available.mockResolvedValue(true);
    state.write.mockImplementationOnce(() => {
      throw new Error('Disk full');
    });
    await expect(exportDiagnosticLog('log', 'Export')).rejects.toThrow('Disk full');
    expect(state.share).not.toHaveBeenCalled();
  });
});
