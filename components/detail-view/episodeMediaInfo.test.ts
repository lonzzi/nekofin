import { MediaSource } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  calculateAspectRatio,
  getAudioInfoRows,
  getResolutionLabel,
  getVideoInfoRows,
} from './episodeMediaInfo';

const baseSource = (mediaStreams: MediaSource['mediaStreams']): MediaSource => ({
  id: 'source-1',
  protocol: 'File',
  container: 'mkv',
  mediaStreams,
});

describe('episodeMediaInfo', () => {
  it('calculates common and reduced aspect ratios', () => {
    expect(calculateAspectRatio(1920, 1080)).toBe('16:9');
    expect(calculateAspectRatio(1440, 1080)).toBe('4:3');
    expect(calculateAspectRatio(1024, 576)).toBe('16:9');
    expect(calculateAspectRatio(1000, 421)).toBe('1000:421');
    expect(calculateAspectRatio(null, 1080)).toBeNull();
  });

  it('formats resolution labels consistently', () => {
    expect(getResolutionLabel(720)).toBe('720p');
    expect(getResolutionLabel(1080)).toBe('1080p');
    expect(getResolutionLabel(2160)).toBe('2160p');
    expect(getResolutionLabel(480)).toBe('480p');
    expect(getResolutionLabel(null)).toBeNull();
  });

  it('builds video rows from the first video stream', () => {
    const rows = getVideoInfoRows(
      baseSource([
        {
          index: 0,
          type: 'Audio',
          codec: 'aac',
          language: 'jpn',
        },
        {
          index: 1,
          type: 'Video',
          codec: 'hevc',
          width: 3840,
          height: 2160,
          averageFrameRate: 23.976,
          bitRate: 12_500_000,
          videoRange: 'HDR10',
          profile: 'Main 10',
          level: 153,
          aspectRatio: null,
          isInterlaced: false,
          bitDepth: 10,
          pixelFormat: 'yuv420p10le',
        },
      ]),
    );

    expect(rows).toEqual([
      { label: '标题', value: '2160p HEVC HDR10' },
      { label: '语言', value: 'Unknown language' },
      { label: '编码', value: 'hevc' },
      { label: '分辨率', value: '3840x2160' },
      { label: '帧率', value: '23.976000' },
      { label: '比特率', value: '12.5 Mbps' },
      { label: '动态范围', value: 'HDR10' },
      { label: '配置', value: 'Main 10' },
      { label: '等级', value: '153.0' },
      { label: '长宽比', value: '16:9' },
      { label: '交错', value: '否' },
      { label: '位深', value: '10' },
      { label: '像素格式', value: 'yuv420p10le' },
    ]);
  });

  it('builds audio rows from the first audio stream', () => {
    const rows = getAudioInfoRows(
      baseSource([
        {
          index: 0,
          type: 'Audio',
          codec: 'flac',
          language: 'jpn',
          title: 'Stereo',
          channelLayout: 'stereo',
          channels: 2,
          bitRate: 850_000,
          sampleRate: 48_000,
          audioProfile: 'Lossless',
          level: 1,
          isDefault: true,
        },
      ]),
    );

    expect(rows).toEqual([
      { label: '标题', value: 'jpn - Stereo' },
      { label: '语言', value: 'jpn' },
      { label: '布局', value: 'stereo' },
      { label: '声道', value: '2' },
      { label: '编码', value: 'flac' },
      { label: '比特率', value: '850 Kbps' },
      { label: '采样率', value: '48000Hz' },
      { label: '动态范围', value: 'Unknown' },
      { label: '配置', value: 'Lossless' },
      { label: '等级', value: '1.0' },
      { label: '外部', value: '否' },
      { label: '默认', value: '是' },
    ]);
  });

  it('returns no rows when streams are missing', () => {
    expect(getVideoInfoRows(baseSource([]))).toEqual([]);
    expect(getAudioInfoRows(baseSource([]))).toEqual([]);
  });
});
