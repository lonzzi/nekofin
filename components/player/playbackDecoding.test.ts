import { describe, expect, it } from 'vitest';

import { parsePlaybackDecodingMode, playbackHwdec } from './playbackDecoding';
import { derivePlaybackMenuActions, parsePlayerMenuAction } from './playerMenuModel';

describe('playback decoding choices', () => {
  it.each(['auto', 'hardware', 'software'] as const)(
    'puts %s in a checked second-level native menu',
    (mode) => {
      const actions = derivePlaybackMenuActions(1, 'fit', undefined, { decodingMode: mode });
      const menu = actions.find((action) =>
        action.subactions?.some((child) => child.id?.startsWith('playback:decoding:')),
      );
      expect(menu?.subactions).toHaveLength(3);
      expect(
        menu?.subactions?.filter((child) => child.state === 'on').map((child) => child.id),
      ).toEqual([`playback:decoding:${mode}`]);
      expect(parsePlayerMenuAction(`playback:decoding:${mode}`)).toEqual({
        kind: 'decoding',
        mode,
      });
    },
  );

  it('lets Android automatic mode use native emulator safeguards and explicit hardware override them', () => {
    expect(playbackHwdec('auto', 'android')).toBe('auto');
    expect(playbackHwdec('hardware', 'android')).toBe('mediacodec');
    expect(playbackHwdec('software', 'android')).toBe('no');
  });

  it('retains the native VideoToolbox default on iOS', () => {
    expect(playbackHwdec('auto', 'ios')).toBe('videotoolbox');
    expect(playbackHwdec('hardware', 'ios')).toBe('videotoolbox');
    expect(playbackHwdec('software', 'ios')).toBe('no');
  });

  it.each([undefined, '', 'no', 'mediacodec', 'hardware:other'])(
    'rejects invalid stored mode %s',
    (value) => {
      expect(parsePlaybackDecodingMode(value)).toBeNull();
      expect(parsePlayerMenuAction(`playback:decoding:${value ?? ''}`)).toBeNull();
    },
  );

  it('omits decoder controls on platforms that cannot implement the selection', () => {
    expect(
      derivePlaybackMenuActions(1).some((action) =>
        action.subactions?.some((child) => child.id?.startsWith('playback:decoding:')),
      ),
    ).toBe(false);
  });
});
