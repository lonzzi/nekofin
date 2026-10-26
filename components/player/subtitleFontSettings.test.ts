import { describe, expect, it, vi } from 'vitest';

import { createSubtitleFontController, fontStyleOverride } from './subtitleFontSettings';

const defaults = {
  directory: '/bundle/ExpoMpvFonts.bundle',
  family: 'Noto Sans CJK SC',
  assOverride: 'no',
};
describe('player subtitle font settings', () => {
  it('replaces only font styles and restores native defaults without track commands', async () => {
    const player = { setPropertyString: vi.fn().mockResolvedValue(undefined) };
    const controller = createSubtitleFontController(defaults);
    await controller.apply(player, {}, () => true);
    expect(player.setPropertyString).not.toHaveBeenCalled();
    await controller.apply(
      player,
      { directory: 'file:///cache/My%20Fonts', family: 'Custom' },
      () => true,
    );
    expect(player.setPropertyString.mock.calls).toEqual([
      ['sub-fonts-dir', '/cache/My Fonts'],
      ['sub-font', 'Custom'],
      ['sub-ass-style-overrides', 'FontName=Custom'],
      ['sub-ass-override', 'yes'],
    ]);
    player.setPropertyString.mockClear();
    await controller.apply(player, {}, () => true);
    expect(player.setPropertyString.mock.calls).toEqual([
      ['sub-fonts-dir', defaults.directory],
      ['sub-font', defaults.family],
      ['sub-ass-style-overrides', ''],
      ['sub-ass-override', 'no'],
    ]);
  });
  it('waits for a custom directory, serializes updates and ignores obsolete work', async () => {
    const player = { setPropertyString: vi.fn().mockResolvedValue(undefined) };
    const controller = createSubtitleFontController(defaults);
    await controller.apply(player, { family: 'pending' }, () => true);
    expect(player.setPropertyString).not.toHaveBeenCalled();
    let active = true;
    player.setPropertyString.mockImplementationOnce(async () => {
      active = false;
    });
    const old = controller.apply(player, { directory: 'file:///old', family: 'Old' }, () => active);
    await old;
    expect(player.setPropertyString.mock.calls).toEqual([['sub-fonts-dir', '/old']]);
    await controller.apply(player, { directory: 'file:///old', family: 'Old' }, () => true);
    expect(player.setPropertyString).toHaveBeenCalledWith('sub-font', 'Old');
    await controller.apply(player, {}, () => true);
    expect(player.setPropertyString).toHaveBeenLastCalledWith('sub-ass-override', 'no');
  });
  it('escapes commas without changing literal backslashes in MPV string lists', () => {
    expect(fontStyleOverride('Font, Name\\Test')).toBe('FontName=Font\\, Name\\Test');
  });
});
