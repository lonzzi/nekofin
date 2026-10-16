import { mapMediaSource } from '@/services/media/mappers';
import {
  parsePlaybackSelection,
  playbackSelectionParams,
  resolvePlaybackSelection,
} from '@/services/media/playbackSelection';
import { describe, expect, it } from 'vitest';

import { createDetailPlaybackMenu } from './detailPlaybackMenu';

const preferences = { audioLanguage: 'auto', subtitleLanguage: 'auto', subtitlesEnabled: true };
const sources = [
  mapMediaSource({
    Id: 'original:version',
    Name: '剧场版',
    DefaultAudioStreamIndex: 0,
    DefaultSubtitleStreamIndex: 9,
    MediaStreams: [
      { Type: 'Audio', Index: 0, DisplayTitle: '日语 - AAC - 2.0', Title: 'File title' },
      { Type: 'Audio', Index: 3, DisplayTitle: '英语 - DTS - 5.1' },
      { Type: 'Subtitle', Index: 9, DisplayTitle: '简体中文 - ASS', IsExternal: true },
    ],
  }),
  mapMediaSource({
    Id: 'other-version',
    MediaStreams: [
      { Type: 'Video', Index: 0, DisplayTitle: '4K HEVC HDR' },
      { Type: 'Audio', Index: 2, DisplayTitle: '日语 - FLAC' },
    ],
  }),
];

describe('detail playback menu', () => {
  it('shows server names and selected states in nested native menus', () => {
    const selected = resolvePlaybackSelection(sources, {}, preferences);
    const menu = createDetailPlaybackMenu(sources, selected);
    expect(menu.actions).toMatchObject([
      {
        title: '剧场版',
        image: 'film',
        subactions: [
          { title: '剧场版', state: 'on' },
          { title: '4K HEVC HDR', state: 'off' },
        ],
      },
      {
        title: '日语 - AAC - 2.0',
        image: 'waveform',
        subactions: [
          { title: '日语 - AAC - 2.0', state: 'on' },
          { title: '英语 - DTS - 5.1', state: 'off' },
        ],
      },
      {
        title: '简体中文 - ASS',
        image: 'captions.bubble',
        subactions: [
          { title: '关闭字幕', state: 'off' },
          { title: '简体中文 - ASS', state: 'on' },
        ],
      },
      {
        title: 'Auto',
        image: 'slider.horizontal.3',
        subactions: expect.arrayContaining([{ id: 'quality:auto', title: 'Auto', state: 'on' }]),
      },
    ]);
  });

  it('carries server indices through audio/subtitle changes and player navigation', () => {
    const selected = resolvePlaybackSelection(sources, {}, preferences);
    const menu = createDetailPlaybackMenu(sources, selected);
    const audioChoice = menu.selections.get('audio:3')!;
    expect(parsePlaybackSelection(playbackSelectionParams(audioChoice))).toEqual({
      mediaSourceId: 'original:version',
      audioStreamIndex: 3,
      subtitleStreamIndex: 9,
    });
    const updatedMenu = createDetailPlaybackMenu(sources, audioChoice);
    expect(updatedMenu.selections.get('source:original:version')).toEqual(audioChoice);
    expect(updatedMenu.selections.get('subtitle:-1')).toEqual({
      mediaSourceId: 'original:version',
      audioStreamIndex: 3,
      subtitleStreamIndex: -1,
    });
    expect(menu.selections.get('audio:999')).toBeUndefined();
  });

  it('resolves new version defaults without reusing another version track indices', () => {
    const menu = createDetailPlaybackMenu(
      sources,
      resolvePlaybackSelection(sources, {}, preferences),
    );
    const choice = menu.selections.get('source:other-version')!;
    expect(choice).toEqual({ mediaSourceId: 'other-version' });
    expect(resolvePlaybackSelection(sources, choice, preferences)).toEqual({
      mediaSourceId: 'other-version',
      audioStreamIndex: 2,
      subtitleStreamIndex: -1,
    });
  });

  it('hides missing tracks and a single version while keeping quality available', () => {
    expect(createDetailPlaybackMenu([], {}).actions).toEqual([]);
    const menu = createDetailPlaybackMenu([{ ...sources[0], mediaStreams: [] }], {
      mediaSourceId: sources[0].id,
      subtitleStreamIndex: -1,
    });
    expect(menu.actions.map((action) => action.title)).toEqual(['Auto']);
    expect([...menu.selections.keys()].every((key) => key.startsWith('quality:'))).toBe(true);
  });

  it('keeps one audio track selectable but hides subtitles when the selected version has none', () => {
    const selected = resolvePlaybackSelection([sources[1]], {}, preferences);
    const menu = createDetailPlaybackMenu([sources[1]], selected);
    expect(menu.actions.map((action) => action.title)).toEqual(['日语 - FLAC', 'Auto']);
    expect(menu.selections.has('audio:2')).toBe(true);
    expect(menu.selections.has('subtitle:-1')).toBe(false);
    expect(menu.selections.has('source:other-version')).toBe(false);
  });

  it('keeps subtitles available when off and hides audio when absent', () => {
    const subtitleOnly = {
      ...sources[0],
      mediaStreams: sources[0].mediaStreams.filter((stream) => stream.type === 'Subtitle'),
    };
    const selected = resolvePlaybackSelection(
      [subtitleOnly],
      { mediaSourceId: subtitleOnly.id, subtitleStreamIndex: -1 },
      preferences,
    );
    const menu = createDetailPlaybackMenu([subtitleOnly], selected);
    expect(menu.actions.map((action) => action.title)).toEqual(['关闭字幕', 'Auto']);
    expect(menu.selections.has('subtitle:9')).toBe(true);
    expect(menu.selections.has('audio:0')).toBe(false);
  });

  it('preserves quality across version and track choices, including navigation', () => {
    const menu = createDetailPlaybackMenu(
      sources,
      resolvePlaybackSelection(sources, {}, preferences),
    );
    const qualityChoice = menu.selections.get('quality:1000000')!;
    expect(qualityChoice).toMatchObject({ audioStreamIndex: 0, subtitleStreamIndex: 9 });
    const updatedMenu = createDetailPlaybackMenu(sources, qualityChoice);
    expect(updatedMenu.actions.at(-1)).toMatchObject({
      title: '1 Mbps',
      subactions: expect.arrayContaining([
        { id: 'quality:1000000', title: '1 Mbps', state: 'on' },
        { id: 'quality:auto', title: 'Auto', state: 'off' },
      ]),
    });
    for (const id of ['audio:3', 'subtitle:-1', 'source:other-version']) {
      const selected = resolvePlaybackSelection(
        sources,
        updatedMenu.selections.get(id)!,
        preferences,
      );
      expect(parsePlaybackSelection(playbackSelectionParams(selected)).quality).toBe('1000000');
    }
    const autoChoice = updatedMenu.selections.get('quality:auto')!;
    expect(createDetailPlaybackMenu(sources, autoChoice).actions.at(-1)?.title).toBe('Auto');
  });
});
