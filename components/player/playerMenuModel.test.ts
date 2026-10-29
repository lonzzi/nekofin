import { describe, expect, it } from 'vitest';

import {
  deriveAutoSkipMenuActions,
  deriveChapterMenuAction,
  deriveDanmakuMenuActions,
  derivePlaybackMenuActions,
  deriveQualityMenuActions,
  deriveTrackMenuActions,
  parsePlayerMenuAction,
} from './playerMenuModel';

describe('player native menu model', () => {
  it('offers independent persistent auto-skip toggles with native selection state', () => {
    expect(deriveAutoSkipMenuActions({ intro: true, outro: false })).toEqual([
      { id: 'playback:autoSkipIntro', title: '自动跳过片头', state: 'on' },
      { id: 'playback:autoSkipOutro', title: '自动跳过片尾', state: 'off' },
    ]);
    expect(parsePlayerMenuAction('playback:autoSkipIntro')).toEqual({ kind: 'autoSkipIntro' });
    expect(parsePlayerMenuAction('playback:autoSkipOutro')).toEqual({ kind: 'autoSkipOutro' });
    expect(parsePlayerMenuAction('playback:autoSkipIntro:unknown')).toBeNull();
  });
  it('seeks to precise chapter times and disables chapter actions until seeking is ready', () => {
    const chapters = [
      { name: 'Opening', startTimeMs: 101018 },
      { name: '', startTimeMs: 3600000 },
    ];
    expect(deriveChapterMenuAction(chapters, false)[0].subactions).toMatchObject([
      { id: 'playback:chapter:101018', title: '1:41  Opening', attributes: { disabled: true } },
      { title: '1:00:00  章节 2' },
    ]);
    expect(deriveChapterMenuAction([], true)).toEqual([]);
    expect(parsePlayerMenuAction('playback:chapter:101018.5')).toEqual({
      kind: 'chapter',
      timeMs: 101018.5,
    });
    for (const id of [
      'playback:chapter:',
      'playback:chapter:NaN',
      'playback:chapter:-1',
      'playback:chapter:Infinity',
    ])
      expect(parsePlayerMenuAction(id)).toBeNull();
  });
  it('offers video versions with the actual media source id', () => {
    const actions = deriveTrackMenuActions(
      undefined,
      undefined,
      [
        { id: 'source:one', name: '1080p', container: 'mkv', protocol: 'File', mediaStreams: [] },
        {
          id: 'source-two',
          name: 'Director cut',
          container: 'mp4',
          protocol: 'File',
          mediaStreams: [],
        },
      ],
      'source-two',
    );
    expect(actions[0]).toMatchObject({
      title: '视频版本',
      subactions: [
        { id: 'source:source:one', title: '1080p', state: 'off' },
        { id: 'source:source-two', title: 'Director cut', state: 'on' },
      ],
    });
    expect(parsePlayerMenuAction('source:source:one')).toEqual({
      kind: 'mediaSource',
      id: 'source:one',
    });
    expect(parsePlayerMenuAction('source:')).toBeNull();
  });
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

  it('keeps pending subtitles selectable without a loading label', () => {
    const pending = { index: 8, name: '简体中文', language: 'zh', loading: true };
    const actions = deriveTrackMenuActions(
      { subtitle: [pending, { index: 12, name: '繁體中文', failed: true }] },
      { subtitle: pending },
    );
    expect(actions[0].title).toBe('字幕 · 简体中文');
    expect(actions[0].subactions).toMatchObject([
      { id: 'track:subtitle:-1', state: 'off' },
      { id: 'track:subtitle:8', state: 'on', subtitle: 'ZH' },
      { id: 'track:subtitle:12', subtitle: '加载失败，点按重试' },
    ]);
    expect(actions[0].subactions?.every((entry) => !entry.attributes?.disabled)).toBe(true);
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

  it('shows all gesture toggles enabled by default and reflects independent preferences', () => {
    expect(derivePlaybackMenuActions(1)[2]).toMatchObject({
      title: '手势控制',
      subactions: [
        { id: 'playback:gesture:brightness', title: '亮度手势', state: 'on' },
        { id: 'playback:gesture:volume', title: '音量手势', state: 'on' },
        { id: 'playback:gesture:seek', title: '进度手势', state: 'on' },
      ],
    });
    expect(
      derivePlaybackMenuActions(1, 'fit', undefined, {
        brightnessGestureEnabled: false,
        volumeGestureEnabled: true,
      })[2].subactions,
    ).toMatchObject([{ state: 'off' }, { state: 'on' }, { state: 'on' }]);
    expect(
      derivePlaybackMenuActions(1, 'fit', undefined, {
        brightnessGestureEnabled: true,
        volumeGestureEnabled: false,
      })[2].subactions,
    ).toMatchObject([{ state: 'on' }, { state: 'off' }, { state: 'on' }]);
    expect(
      derivePlaybackMenuActions(1, 'fit', undefined, {
        seekGestureEnabled: false,
      })[2].subactions,
    ).toMatchObject([{ state: 'on' }, { state: 'on' }, { state: 'off' }]);
    expect(parsePlayerMenuAction('playback:gesture:brightness')).toEqual({
      kind: 'brightnessGestureToggle',
    });
    expect(parsePlayerMenuAction('playback:gesture:volume')).toEqual({
      kind: 'volumeGestureToggle',
    });
    expect(parsePlayerMenuAction('playback:gesture:seek')).toEqual({
      kind: 'seekGestureToggle',
    });
    expect(parsePlayerMenuAction('playback:gesture:unknown')).toBeNull();
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

it('exposes supported quality caps as a native menu with the current cap checked', () => {
  const actions = deriveQualityMenuActions('2000000');
  expect(actions.find((action) => action.id === 'playback:quality:2000000')).toMatchObject({
    title: '2 Mbps',
    state: 'on',
  });
  expect(actions.filter((action) => action.state === 'on')).toHaveLength(1);
  expect(parsePlayerMenuAction('playback:quality:2000000')).toEqual({
    kind: 'quality',
    quality: '2000000',
  });
  expect(parsePlayerMenuAction('playback:quality:auto')).toEqual({
    kind: 'quality',
    quality: 'auto',
  });
  for (const value of ['1e6', '0', '-1', '99999999', ''])
    expect(parsePlayerMenuAction(`playback:quality:${value}`)).toBeNull();
});
