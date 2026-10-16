import { playbackQualityOptions } from '@/services/media/playbackQuality';
import {
  playbackSourceLabel,
  playbackTrackLabel,
  type PlaybackSelection,
} from '@/services/media/playbackSelection';
import type { MediaSource } from '@/services/media/types';
import type { MenuAction } from '@react-native-menu/menu';

export function createDetailPlaybackMenu(
  sources: MediaSource[],
  selected: PlaybackSelection,
  platform: 'ios' | 'android' = 'ios',
) {
  const selections = new Map<string, PlaybackSelection>();
  const source = sources.find((entry) => entry.id === selected.mediaSourceId);
  if (!source) return { actions: [] as MenuAction[], selections };

  const option = (
    id: string,
    title: string,
    active: boolean,
    selection: PlaybackSelection,
  ): MenuAction => {
    selections.set(id, selection);
    return { id, title, state: active ? 'on' : 'off' };
  };
  const audio = source.mediaStreams.filter((stream) => stream.type === 'Audio');
  const subtitles = source.mediaStreams.filter((stream) => stream.type === 'Subtitle');
  const audioTrack = audio.find((stream) => stream.index === selected.audioStreamIndex);
  const subtitleTrack = subtitles.find((stream) => stream.index === selected.subtitleStreamIndex);
  const quality = selected.quality ?? 'auto';
  const actions: MenuAction[] = [];
  if (sources.length > 1) {
    actions.push({
      title: playbackSourceLabel(source, sources.indexOf(source)),
      image: platform === 'ios' ? 'film' : 'ic_menu_slideshow',
      subactions: sources.map((entry, index) =>
        option(
          `source:${entry.id}`,
          playbackSourceLabel(entry, index),
          entry.id === source.id,
          // Stream indices are scoped to a version; resolve its defaults afresh.
          entry.id === source.id
            ? selected
            : { mediaSourceId: entry.id, ...(selected.quality ? { quality } : {}) },
        ),
      ),
    });
  }
  if (audio.length) {
    actions.push({
      title: audioTrack ? playbackTrackLabel(audioTrack) : '暂无可用音轨',
      image: platform === 'ios' ? 'waveform' : 'ic_lock_silent_mode_off',
      subactions: audio.map((stream) =>
        option(
          `audio:${stream.index}`,
          playbackTrackLabel(stream),
          stream.index === selected.audioStreamIndex,
          { ...selected, audioStreamIndex: stream.index },
        ),
      ),
    });
  }
  if (subtitles.length) {
    actions.push({
      title: subtitleTrack ? playbackTrackLabel(subtitleTrack) : '关闭字幕',
      image: platform === 'ios' ? 'captions.bubble' : 'ic_menu_edit',
      subactions: [
        option('subtitle:-1', '关闭字幕', !subtitleTrack, {
          ...selected,
          subtitleStreamIndex: -1,
        }),
        ...subtitles.map((stream) =>
          option(
            `subtitle:${stream.index}`,
            playbackTrackLabel(stream),
            stream.index === selected.subtitleStreamIndex,
            { ...selected, subtitleStreamIndex: stream.index },
          ),
        ),
      ],
    });
  }
  actions.push({
    title: playbackQualityOptions.find((entry) => entry.id === quality)!.title,
    image: platform === 'ios' ? 'slider.horizontal.3' : 'ic_menu_manage',
    subactions: playbackQualityOptions.map((entry) =>
      option(`quality:${entry.id}`, entry.title, entry.id === quality, {
        ...selected,
        quality: entry.id,
      }),
    ),
  });
  return { actions, selections };
}
