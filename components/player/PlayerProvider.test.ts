import { createElement as el, type PropsWithChildren } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

import { Controls } from './Controls';
import { usePlayer, type PlayerContextValue, type PlayerLifecycleState } from './PlayerContext';
import { createPlayerExitPreparation } from './playerExitPreparation';
import { PlayerProvider, type PlayerPlaybackInput } from './PlayerProvider';

const state = vi.hoisted(() => ({ platform: 'ios' }));
const contexts: { surface?: PlayerContextValue; controls?: PlayerContextValue } = {};

vi.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-native', () => ({
  AccessibilityInfo: {},
  Platform: {
    get OS() {
      return state.platform;
    },
  },
  StyleSheet: { absoluteFill: {} },
  View: ({ children }: PropsWithChildren) => el('div', null, children),
}));
vi.mock('react-native-reanimated', () => ({
  Easing: {},
  ReduceMotion: {},
  useSharedValue: (value: unknown) => ({
    value,
    get() {
      return this.value;
    },
    set(next: unknown) {
      this.value = next;
    },
  }),
  withTiming: (value: number) => value,
}));
vi.mock('./TopControls', () => ({
  TopControls: () => {
    contexts.controls = usePlayer();
    return el('span', null, 'player-controls');
  },
}));
vi.mock('./BottomControls', () => ({ BottomControls: () => null }));
vi.mock('./GestureHandler', () => ({ GestureHandler: () => null }));
vi.mock('./LockControls', () => ({ LockControls: () => null }));
vi.mock('./OverlayGradients', () => ({
  BottomOverlayGradient: () => null,
  ContentOverlayScrim: () => null,
  TopOverlayGradient: () => null,
}));
vi.mock('./SeekPreview', () => ({ SeekPreview: () => null }));
vi.mock('./panels/DanmakuPanel', () => ({ DanmakuPanel: () => null }));
vi.mock('./panels/DanmakuSearchPanel', () => ({ DanmakuSearchPanel: () => null }));
vi.mock('./panels/EpisodePanel', () => ({ EpisodePanel: () => null }));
vi.mock('./panels/PlayerPanelHost', () => ({ PlayerPanelHost: () => null }));

const playback: PlayerPlaybackInput = {
  title: 'Episode 1',
  isPlaying: true,
  isLoading: false,
  isPlayerReady: true,
  duration: 120_000,
  currentTime: { value: 30_000 } as PlayerPlaybackInput['currentTime'],
  onSeek: vi.fn(),
  onPlayPause: vi.fn(),
  rate: 1,
  danmakuComments: [],
  episodes: [],
  onEpisodeSelect: vi.fn(),
};

function Surface() {
  contexts.surface = usePlayer();
  return el('span', null, 'video-surface');
}

function render(lifecycle?: PlayerLifecycleState) {
  return renderToStaticMarkup(
    el(PlayerProvider, { playback, lifecycle }, el(Surface), el(Controls)),
  );
}

beforeEach(() => {
  state.platform = 'ios';
  delete contexts.surface;
  delete contexts.controls;
  vi.clearAllMocks();
});

it('shares playback, lifecycle, controls and panels with the surface and its sibling UI', () => {
  const lifecycle = {
    entryVisible: true,
    isExiting: false,
    exitPreparation: createPlayerExitPreparation(),
  };
  const html = render(lifecycle);
  expect(html).toContain('video-surface');
  expect(html).toContain('player-controls');
  expect(contexts.controls).toBe(contexts.surface);
  expect(contexts.surface?.lifecycle).toBe(lifecycle);
  expect(contexts.surface?.playback.canSeek).toBe(true);
  expect(contexts.surface?.controls.isInteractionLocked()).toBe(false);
  expect(contexts.surface?.panels.active).toBeUndefined();
  contexts.controls?.playback.onPlayPause();
  expect(playback.onPlayPause).toHaveBeenCalledOnce();
});

it('hides iOS controls during accepted exit without removing their sibling surface', () => {
  const html = render({ entryVisible: true, isExiting: true, exitPreparation: null });
  expect(html).toContain('video-surface');
  expect(html).not.toContain('player-controls');
  expect(contexts.controls).toBeUndefined();
  expect(contexts.surface?.controls.overlaysVisible).toBe(false);
});

it('waits for entry visibility before mounting the controls', () => {
  const html = render({ entryVisible: false, isExiting: false, exitPreparation: null });
  expect(html).toContain('video-surface');
  expect(html).not.toContain('player-controls');
});

it('retains the existing Android controls presentation during exit', () => {
  state.platform = 'android';
  expect(render({ entryVisible: true, isExiting: true, exitPreparation: null })).toContain(
    'player-controls',
  );
});

it('provides the same Player API to the lab without navigation lifecycle wiring', () => {
  expect(render()).toContain('player-controls');
  expect(contexts.surface?.lifecycle).toEqual({
    entryVisible: true,
    isExiting: false,
    exitPreparation: null,
  });
});

it('locks interaction and clears active gestures through the shared controller', () => {
  render();
  const controls = contexts.surface!.controls;
  controls.isGestureSeekingActive.set(true);
  controls.isVolumeGestureActive.set(true);
  controls.isBrightnessGestureActive.set(true);
  controls.onToggleLock();
  expect(controls.isInteractionLocked()).toBe(true);
  expect(controls.isGestureSeekingActive.get()).toBe(false);
  expect(controls.isVolumeGestureActive.get()).toBe(false);
  expect(controls.isBrightnessGestureActive.get()).toBe(false);
});

it('fails clearly when a player component has no shared provider', () => {
  expect(() => renderToStaticMarkup(el(Controls))).toThrow(
    'usePlayer must be used within PlayerProvider',
  );
});
