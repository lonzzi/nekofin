import { createElement as el } from 'react';
import { expect, it, vi } from 'vitest';

import type { PlayerLifecycleState } from './PlayerContext';
import { createPlayerExitPreparation } from './playerExitPreparation';
import { PlayerSession } from './PlayerSession';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (create: () => unknown) => create(),
}));
vi.mock('./index', () => ({ VideoPlayer: () => null }));
vi.mock('@/lib/i18n', () => ({ t: (key: string) => key }));

const lifecycle: PlayerLifecycleState = {
  entryVisible: false,
  isExiting: false,
  exitPreparation: createPlayerExitPreparation(),
};

it('keeps the playback session identity through entry and exit lifecycle changes', () => {
  const entering = PlayerSession({ params: { itemId: 'episode-1' }, lifecycle });
  const exiting = PlayerSession({
    params: { itemId: 'episode-1' },
    lifecycle: { ...lifecycle, entryVisible: true, isExiting: true },
  });
  expect(exiting.type).toBe(entering.type);
  expect(exiting.key).toBe(entering.key);
  expect(exiting.props.lifecycle.exitPreparation).toBe(lifecycle.exitPreparation);
});

it('remounts the playback session for a new episode while retaining exit preparation', () => {
  const first = PlayerSession({ params: { itemId: 'episode-1' }, lifecycle });
  const next = PlayerSession({ params: { itemId: 'episode-2' }, lifecycle });
  expect(next.key).not.toBe(first.key);
  expect(next.props.itemId).toBe('episode-2');
  expect(next.props.lifecycle).toBe(first.props.lifecycle);
});

it('passes playback selections and the native screen content into the shared player', () => {
  const children = el('span', null, 'native screen content');
  const element = PlayerSession({
    params: {
      itemId: 'episode-1',
      mediaSourceId: 'version-2',
      audioStreamIndex: '3',
      subtitleStreamIndex: '-1',
      quality: 'auto',
    },
    lifecycle,
    children,
  });
  expect(element.props.initialSelection).toEqual({
    mediaSourceId: 'version-2',
    audioStreamIndex: 3,
    subtitleStreamIndex: -1,
    quality: 'auto',
  });
  expect(element.props.children).toBe(children);
});

it('retains route parameter decoding when wrapping the native screen', () => {
  const element = PlayerSession({
    params: {
      itemId: 'episode%2F1',
      mediaSourceId: 'version%20two',
      audioStreamIndex: '%33',
    },
    lifecycle,
  });
  expect(element.props.itemId).toBe('episode/1');
  expect(element.props.initialSelection).toMatchObject({
    mediaSourceId: 'version two',
    audioStreamIndex: 3,
  });
});

it('retains malformed URI values instead of failing player presentation', () => {
  const element = PlayerSession({
    params: { itemId: 'episode-1', mediaSourceId: 'version%broken' },
    lifecycle,
  });
  expect(element.props.initialSelection?.mediaSourceId).toBe('version%broken');
});
