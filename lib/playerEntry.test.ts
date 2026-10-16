import { describe, expect, it } from 'vitest';

import { resolvePlayerEntryVisibility } from './playerEntry';

describe('initial player presentation', () => {
  it('waits for an actual landscape viewport, even before Expo can report orientation', () => {
    expect(resolvePlayerEntryVisibility(false, { width: 0, height: 0 })).toBe(false);
    expect(resolvePlayerEntryVisibility(false, { width: 402, height: 874 })).toBe(false);
    expect(resolvePlayerEntryVisibility(false, { width: 874, height: 402 })).toBe(true);
  });

  it('honors portrait preference without revealing a stale landscape frame', () => {
    expect(
      resolvePlayerEntryVisibility(false, { preference: 'portrait', width: 874, height: 402 }),
    ).toBe(false);
    expect(
      resolvePlayerEntryVisibility(false, { preference: 'portrait', width: 402, height: 874 }),
    ).toBe(true);
  });

  it('allows automatic orientation and iPad multitasking after measurement', () => {
    expect(resolvePlayerEntryVisibility(false, { preference: 'auto', width: 0, height: 0 })).toBe(
      false,
    );
    expect(
      resolvePlayerEntryVisibility(false, { preference: 'auto', width: 402, height: 874 }),
    ).toBe(true);
    expect(
      resolvePlayerEntryVisibility(false, { width: 500, height: 900, flexibleWindow: true }),
    ).toBe(true);
  });

  it('never hides a presented player when rotating for exit or changing episodes', () => {
    expect(resolvePlayerEntryVisibility(true, { width: 402, height: 874 })).toBe(true);
    expect(resolvePlayerEntryVisibility(true, { width: 0, height: 0 })).toBe(true);
  });
});
