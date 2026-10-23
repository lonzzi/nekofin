import { i18n } from '@/lib/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import {
  derivePlaybackInfoBadges,
  derivePlaybackInfoSummary,
  derivePlaybackSourceInfo,
} from './playbackInfo';

const source = {
  Bitrate: 12_000_000,
  TranscodingUrl: '/Videos/id/master.m3u8?VideoCodec=h264',
  MediaStreams: [
    { Type: 'Video', Codec: 'hevc', Width: 3840, Height: 2160, AverageFrameRate: 23.976 },
  ],
};

afterEach(() => i18n.changeLanguage('zh-Hans'));

describe('actual playback information', () => {
  it.each(['zh-Hans', 'en'] as const)(
    'keeps compact bitrate and decoder values independent of %s labels',
    async (language) => {
      await i18n.changeLanguage(language);
      const badges = derivePlaybackInfoBadges(
        { ...derivePlaybackSourceInfo('https://test/stream', source), method: 'transcode' },
        { videoCodec: 'h264', width: 1280, height: 720, hwdecCurrent: 'mediacodec' },
      );
      const summary = derivePlaybackInfoSummary(badges);
      expect(summary.map((badge) => badge.text)).toEqual([
        language === 'en' ? 'Transcoding' : '转码',
        'H.264',
        '720p',
        'HW',
        '12.0M',
      ]);
      expect(badges.find((badge) => badge.key === 'bitrate')?.text).toBe(
        language === 'en' ? 'Source 12.0 Mbps' : '源码率 12.0 Mbps',
      );
      expect(
        derivePlaybackInfoSummary(derivePlaybackInfoBadges({ method: 'transcode' })).find(
          (badge) => badge.key === 'bitrate',
        )?.text,
      ).toBe('—');
    },
  );

  it('keeps codec, resolution, decoder and source bitrate compact while retaining full details', () => {
    const badges = derivePlaybackInfoBadges(
      derivePlaybackSourceInfo('https://test/Videos/id/stream', source),
      { hwdecCurrent: 'videotoolbox-copy', videoBitrate: 5_000_000, audioBitrate: 500_000 },
    );
    const summary = derivePlaybackInfoSummary(badges);
    expect(summary.map((badge) => badge.text)).toEqual(['HEVC', '2160p', 'HW', '12.0M']);
    expect(summary[1].accessibilityLabel).toBe('分辨率：3840 × 2160');
    expect(summary[2].accessibilityLabel).toContain('VideoToolbox（拷贝）');
    expect(badges.some((badge) => badge.key === 'resolution')).toBe(true);
    const transcode = derivePlaybackInfoBadges(
      { method: 'transcode', bitrateLimit: 1_000_000 },
      { hwdecCurrent: 'no' },
    );
    expect(derivePlaybackInfoSummary(transcode).map((badge) => badge.text)).toEqual([
      '转码',
      'SW',
      '—',
    ]);
  });
  it('marks server transcoding only and shows the codec actually played', () => {
    const original = derivePlaybackSourceInfo('https://test/Videos/id/stream', source);
    for (const method of ['directPlay', 'remux', 'videoCopy'] as const) {
      const summary = derivePlaybackInfoSummary(
        derivePlaybackInfoBadges(
          { ...original, method },
          {
            videoCodec: 'hevc',
            hwdecCurrent: 'mediacodec',
          },
        ),
      );
      expect(summary.some((badge) => badge.key === 'method')).toBe(false);
      expect(summary.find((badge) => badge.key === 'format')?.text).toBe('HEVC');
    }
    const summary = derivePlaybackInfoSummary(
      derivePlaybackInfoBadges(
        { ...original, method: 'transcode' },
        {
          videoCodec: 'h264 (H.264 / AVC)',
          fps: 23.976,
          hwdecCurrent: 'mediacodec',
        },
      ),
    );
    expect(summary.map((badge) => badge.text)).toEqual(['转码', 'H.264', 'HW', '12.0M']);
    expect(summary[0].accessibilityLabel).toBe('播放方式：服务器转码');
    expect(
      derivePlaybackInfoSummary(derivePlaybackInfoBadges({ method: 'audioTranscode' })).find(
        (badge) => badge.key === 'method',
      )?.text,
    ).toBe('音频转码');
    expect(
      derivePlaybackInfoSummary(
        derivePlaybackInfoBadges({ method: 'transcode' }, { fps: 24 }),
      ).some((badge) => badge.key === 'format'),
    ).toBe(false);
  });
  it('reports the opened direct-play URL even when another transcoding URL is available', () => {
    expect(
      derivePlaybackSourceInfo('https://test/jellyfin/Videos/id/stream?static=true', source).method,
    ).toBe('directPlay');
    expect(derivePlaybackSourceInfo(null, source).method).toBe('pending');
    expect(derivePlaybackSourceInfo('https://test/stream').method).toBe('pending');
    expect(
      derivePlaybackSourceInfo('https://test/stream?Static=true', {
        TranscodingUrl: '/stream?VideoCodec=h264',
      }).method,
    ).toBe('directPlay');
  });
  it('distinguishes video transcoding, audio transcoding and container remux from the opened route', () => {
    for (const [query, method] of [
      ['VideoCodec=h264', 'transcode'],
      ['VideoCodec=copy&AudioCodec=aac', 'audioTranscode'],
      ['videocodec=copy&audiocodec=copy', 'remux'],
      ['VideoCodec=copy', 'videoCopy'],
    ] as const) {
      expect(
        derivePlaybackSourceInfo(`https://test/jellyfin/Videos/id/master.m3u8?${query}`, source)
          .method,
      ).toBe(method);
    }
  });
  it('uses hwdec-current and never mistakes configured hardware decoding for active hardware decoding', () => {
    const stream = derivePlaybackSourceInfo('https://test/Videos/id/stream', source);
    expect(
      derivePlaybackInfoBadges(stream, { hwdec: 'videotoolbox', hwdecCurrent: 'no' }).find(
        (badge) => badge.key === 'decoder',
      )?.text,
    ).toBe('软件解码');
    expect(
      derivePlaybackInfoBadges(stream, { hwdec: 'videotoolbox', hwdecCurrent: '' }).find(
        (badge) => badge.key === 'decoder',
      )?.text,
    ).toBe('解码待确认');
    for (const [active, label] of [
      ['videotoolbox', 'VideoToolbox'],
      ['mediacodec-copy', 'MediaCodec（拷贝）'],
      ['nvdec', 'NVDEC'],
    ]) {
      expect(
        derivePlaybackInfoBadges(stream, { hwdecCurrent: active }).find(
          (badge) => badge.key === 'decoder',
        )?.text,
      ).toBe(`硬解 · ${label}`);
    }
  });
  it('shows actual transcoded dimensions and codecs rather than original-file metadata', () => {
    const stream = derivePlaybackSourceInfo(
      'https://test/Videos/id/master.m3u8?VideoCodec=h264',
      source,
    );
    const badges = derivePlaybackInfoBadges(stream, {
      hwdecCurrent: 'no',
      width: 1280,
      height: 720,
      videoCodec: 'h264 (H.264 / AVC)',
      fps: 23.976,
      videoBitrate: 900000,
      audioBitrate: 100000,
    });
    expect(badges.map((badge) => badge.text)).toEqual([
      '服务器转码',
      '软件解码',
      '1280×720',
      'H.264 · 23.98 fps',
      '源码率 12.0 Mbps',
      '实时码率 1.0 Mbps',
    ]);
    expect(derivePlaybackInfoSummary(badges).map((badge) => badge.text)).toEqual([
      '转码',
      'H.264',
      '720p',
      'SW',
      '12.0M',
    ]);
    expect(
      derivePlaybackInfoBadges(stream).some((badge) =>
        ['resolution', 'format'].includes(badge.key),
      ),
    ).toBe(false);
    expect(derivePlaybackInfoBadges(stream).find((badge) => badge.key === 'bitrate')?.text).toBe(
      '源码率 12.0 Mbps',
    );
    const capped = derivePlaybackSourceInfo(
      'https://test/Videos/id/master.m3u8?VideoCodec=h264',
      source,
      1000000,
    );
    expect(
      derivePlaybackInfoBadges(capped).find((badge) => badge.key === 'bitrateLimit')?.text,
    ).toBe('上限 1.0 Mbps');
  });
  it('labels a direct-play fallback bitrate as source metadata and rejects invalid samples', () => {
    const stream = derivePlaybackSourceInfo('https://test/Videos/id/stream', source);
    const badges = derivePlaybackInfoBadges(stream, {
      width: NaN,
      height: -1,
      fps: Infinity,
      videoBitrate: 0,
      audioBitrate: 1234,
    });
    expect(badges.find((badge) => badge.key === 'resolution')?.text).toBe('3840×2160');
    expect(badges.find((badge) => badge.key === 'bitrate')?.text).toBe('源码率 12.0 Mbps');
    expect(JSON.stringify(badges)).not.toMatch(/NaN|Infinity|https/);
  });
  it('keeps resolution dimensions from one source and preserves portrait dimensions', () => {
    const stream = derivePlaybackSourceInfo('https://test/Videos/id/stream', source);
    const incomplete = derivePlaybackInfoBadges(stream, { width: 1920, height: 0 });
    expect(incomplete.find((badge) => badge.key === 'resolution')?.text).toBe('3840×2160');
    const portrait = derivePlaybackInfoSummary(
      derivePlaybackInfoBadges(stream, { width: 1080, height: 1920 }),
    );
    expect(portrait.find((badge) => badge.key === 'resolution')?.text).toBe('1080×1920');
    expect(
      derivePlaybackInfoBadges({ ...stream, method: 'transcode' }, { width: 1920, height: 0 }).some(
        (badge) => badge.key === 'resolution',
      ),
    ).toBe(false);
  });
  it('uses the selected source video bitrate regardless of changing native samples or transcoding', () => {
    const mediaSource = {
      ...source,
      MediaStreams: [{ ...source.MediaStreams[0], BitRate: 10_000_000 }],
    };
    for (const url of [
      'https://test/Videos/id/stream',
      'https://test/Videos/id/master.m3u8?VideoCodec=h264',
    ]) {
      const stream = derivePlaybackSourceInfo(url, mediaSource, 1_000_000);
      for (const videoBitrate of [500_000, 8_000_000]) {
        const badges = derivePlaybackInfoBadges(stream, { videoBitrate });
        const summary = derivePlaybackInfoSummary(badges);
        expect(summary.find((badge) => badge.key === 'bitrate')).toMatchObject({
          text: '10.0M',
          accessibilityLabel: '源文件视频码率：10.0 Mbps',
        });
        expect(badges.find((badge) => badge.key === 'currentBitrate')?.text).toContain('实时码率');
      }
    }
  });
  it('keeps absent source metadata unknown instead of substituting realtime bitrate or a request limit', () => {
    const unknown = derivePlaybackSourceInfo(
      'https://test/Videos/id/master.m3u8?VideoCodec=h264',
      {
        TranscodingUrl: '/Videos/id/master.m3u8',
        Bitrate: -1,
        MediaStreams: [{ Type: 'Video', BitRate: NaN }],
      },
      1_000_000,
    );
    const badges = derivePlaybackInfoBadges(unknown, { videoBitrate: 900_000 });
    expect(derivePlaybackInfoSummary(badges).find((badge) => badge.key === 'bitrate')?.text).toBe(
      '—',
    );
    expect(badges.find((badge) => badge.key === 'currentBitrate')?.text).toBe('实时码率 900 Kbps');
    expect(badges.find((badge) => badge.key === 'bitrateLimit')?.text).toBe('上限 1.0 Mbps');
  });
});
