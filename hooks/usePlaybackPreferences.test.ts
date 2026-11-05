import { mapMediaSource } from '@/services/media/mappers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readPlaybackPreferences, rememberSubtitlePreference } from './usePlaybackPreferences';

const { values } = vi.hoisted(() => ({ values: new Map<string, unknown>() }));
vi.mock('@/lib/storage', () => ({
  storage: {
    getString: (key: string) => values.get(key),
    getBoolean: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
  },
}));
vi.mock('react-native-mmkv', () => ({ useMMKVString: vi.fn(), useMMKVBoolean: vi.fn() }));

const server = { id: 'server', userId: 'user' };
const item = { id: 'e7', type: 'Episode' as const, seriesId: 'series' };
const source = mapMediaSource({
  Id: 'e7',
  MediaStreams: [{ Type: 'Subtitle', Index: 0, Title: 'Big5', Codec: 'ass', IsExternal: true }],
});

beforeEach(() => values.clear());

describe('remembered subtitle storage', () => {
  it('restores a manual choice for a fresh episode without changing global preferences', () => {
    rememberSubtitlePreference({ server, item }, source, 0);
    expect(
      readPlaybackPreferences({ server, item: { ...item, id: 'e8' } }).subtitleChoice,
    ).toMatchObject({ mode: 'track', title: 'big5', external: true });
    expect(readPlaybackPreferences().subtitleChoice).toBeUndefined();
    expect(
      readPlaybackPreferences({ server: { ...server, userId: 'other' }, item }).subtitleChoice,
    ).toBeUndefined();
    expect(
      readPlaybackPreferences({ server, item: { ...item, seriesId: 'other-series' } })
        .subtitleChoice,
    ).toBeUndefined();
  });

  it('persists disabling and ignores invalid selections', () => {
    rememberSubtitlePreference({ server, item }, source, -1);
    rememberSubtitlePreference({ server, item }, source, 99);
    expect(readPlaybackPreferences({ server, item }).subtitleChoice).toEqual({ mode: 'off' });
  });
});
