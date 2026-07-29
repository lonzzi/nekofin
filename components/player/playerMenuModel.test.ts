import { describe, expect, it } from 'vitest';

import {
  deriveDanmakuMenuActions,
  derivePlaybackMenuActions,
  deriveTrackMenuActions,
  parsePlayerMenuAction,
} from './playerMenuModel';

describe('player native menu model', () => {
  it('models danmaku as a toggle plus advanced actions', () => {
    const actions = deriveDanmakuMenuActions({ commentCount: 128, enabled: true });

    expect(actions).toMatchObject([
      { id: 'danmaku:toggle', state: 'on', title: '显示弹幕' },
      { id: 'danmaku:settings', subtitle: '当前 128 条' },
      { id: 'danmaku:search' },
    ]);
  });

  it('groups subtitle and audio tracks and keeps native selection state', () => {
    const actions = deriveTrackMenuActions(
      {
        audio: [
          { index: 3, name: '' },
          { index: 2, name: '日语', language: 'ja' },
          { index: 2, name: '重复音轨' },
          { index: -1, name: '无效音轨' },
        ],
        subtitle: [
          { index: 5, name: '' },
          { index: 4, name: '简体中文', language: 'zh' },
        ],
      },
      {
        audio: { index: 2, name: '日语', language: 'ja' },
        subtitle: { index: 4, name: '简体中文', language: 'zh' },
      },
    );

    expect(actions[0].subactions).toMatchObject([
      { id: 'track:subtitle:-1', state: 'off' },
      { id: 'track:subtitle:4', state: 'on', subtitle: 'ZH' },
      { id: 'track:subtitle:5', title: '字幕 5' },
    ]);
    expect(actions[1].subactions).toMatchObject([
      { id: 'track:audio:2', state: 'on', subtitle: 'JA' },
      { id: 'track:audio:3', title: '音轨 3' },
    ]);
  });

  it('shows disabled native menu feedback when no audio track exists', () => {
    const actions = deriveTrackMenuActions();

    expect(actions[0].subactions).toMatchObject([
      { id: 'track:subtitle:-1', state: 'on', title: '关闭字幕' },
    ]);
    expect(actions[1].subactions).toEqual([
      { attributes: { disabled: true }, title: '暂无可用音轨' },
    ]);
  });

  it('models playback choices as selected native submenus', () => {
    const actions = derivePlaybackMenuActions(1.5, 'fill');

    expect(actions[0]).toMatchObject({ title: '播放速度 · 1.5×' });
    expect(
      actions[0].subactions?.find((action) => action.id === 'playback:rate:1.5'),
    ).toMatchObject({ state: 'on' });
    expect(
      actions[1].subactions?.find((action) => action.id === 'playback:aspect:fill'),
    ).toMatchObject({ state: 'on' });
  });

  it('parses only supported menu actions', () => {
    expect(parsePlayerMenuAction('track:subtitle:-1')).toEqual({
      kind: 'subtitleTrack',
      trackIndex: -1,
    });
    expect(parsePlayerMenuAction('track:audio:2')).toEqual({ kind: 'audioTrack', trackIndex: 2 });
    expect(parsePlayerMenuAction('playback:rate:1.25')).toEqual({ kind: 'rate', rate: 1.25 });
    expect(parsePlayerMenuAction('playback:aspect:16:9')).toEqual({
      aspectRatio: '16:9',
      kind: 'aspectRatio',
    });
    expect(parsePlayerMenuAction('playback:rate:3')).toBeNull();
    expect(parsePlayerMenuAction('track:audio:not-a-number')).toBeNull();
    expect(parsePlayerMenuAction('track:audio:')).toBeNull();
    expect(parsePlayerMenuAction('track:audio:1e3')).toBeNull();
    expect(parsePlayerMenuAction('track:audio:0x10')).toBeNull();
    expect(parsePlayerMenuAction(`track:audio:${Number.MAX_SAFE_INTEGER + 1}`)).toBeNull();
    expect(parsePlayerMenuAction('unknown')).toBeNull();
  });
});
