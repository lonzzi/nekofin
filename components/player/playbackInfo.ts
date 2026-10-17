import type { MediaInfo } from 'expo-mpv';

export type PlaybackMethod =
  | 'pending'
  | 'directPlay'
  | 'transcode'
  | 'audioTranscode'
  | 'remux'
  | 'videoCopy';
export type PlaybackSourceInfo = {
  method: PlaybackMethod;
  sourceBitrate?: number;
  sourceVideoBitrate?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFps?: number;
  sourceCodec?: string;
  bitrateLimit?: number;
};
export type PlaybackInfoBadge = {
  key: string;
  text: string;
  compactText?: string;
  accessibilityLabel: string;
  tone?: 'positive';
};
type Source = {
  TranscodingUrl?: string | null;
  Bitrate?: number | null;
  MediaStreams?:
    | {
        Type?: string | null;
        Codec?: string | null;
        BitRate?: number | null;
        Width?: number | null;
        Height?: number | null;
        AverageFrameRate?: number | null;
        RealFrameRate?: number | null;
      }[]
    | null;
};
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function derivePlaybackSourceInfo(
  url: string | null | undefined,
  source?: Source,
  bitrateLimit?: number,
): PlaybackSourceInfo {
  let method: PlaybackMethod = url && source ? 'directPlay' : 'pending';
  if (url && source?.TranscodingUrl) {
    try {
      const actual = new URL(url);
      const negotiated = new URL(source.TranscodingUrl, 'https://media.invalid');
      // Judge the route actually opened by mpv, not merely the presence of an available URL.
      const params = new Map(
        [...actual.searchParams].map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]),
      );
      if (actual.pathname.endsWith(negotiated.pathname) && params.get('static') !== 'true') {
        method =
          params.get('videocodec') === 'copy'
            ? params.get('audiocodec') === 'copy'
              ? 'remux'
              : params.get('audiocodec')
                ? 'audioTranscode'
                : 'videoCopy'
            : 'transcode';
      }
    } catch {
      method = 'pending';
    }
  }
  const video = source?.MediaStreams?.find((stream) => stream.Type === 'Video');
  return {
    method,
    sourceBitrate: positive(source?.Bitrate) ? source.Bitrate : undefined,
    sourceVideoBitrate: positive(video?.BitRate) ? video.BitRate : undefined,
    sourceWidth: positive(video?.Width) ? video.Width : undefined,
    sourceHeight: positive(video?.Height) ? video.Height : undefined,
    sourceFps: positive(video?.AverageFrameRate)
      ? video.AverageFrameRate
      : positive(video?.RealFrameRate)
        ? video.RealFrameRate
        : undefined,
    sourceCodec: video?.Codec || undefined,
    bitrateLimit: positive(bitrateLimit) ? bitrateLimit : undefined,
  };
}

function codecLabel(codec?: string) {
  if (!codec) return undefined;
  const name = codec.toLowerCase();
  if (/\bhevc\b|\bh\.?265\b/.test(name)) return 'HEVC';
  if (/\bh\.?264\b|\bavc\b/.test(name)) return 'H.264';
  if (/\bav1\b/.test(name)) return 'AV1';
  if (/\bvp9\b/.test(name)) return 'VP9';
  return codec.split(/[\s(]/)[0].toUpperCase().slice(0, 20) || undefined;
}
function bitrateLabel(value: number) {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)} Mbps`
    : `${Math.round(value / 1000)} Kbps`;
}

export function derivePlaybackInfoBadges(
  source: PlaybackSourceInfo,
  info?: Partial<MediaInfo> | null,
): PlaybackInfoBadge[] {
  const method = {
    pending: '读取播放信息…',
    directPlay: '直接播放',
    transcode: '服务器转码',
    audioTranscode: '音频转码',
    remux: '服务器封装',
    videoCopy: '视频直通',
  }[source.method];
  const badges: PlaybackInfoBadge[] = [
    {
      key: 'method',
      text: method,
      accessibilityLabel: `播放方式：${method}`,
      tone: source.method === 'directPlay' ? 'positive' : undefined,
    },
  ];
  const activeDecoder = info?.hwdecCurrent?.trim();
  let decoder = '解码待确认';
  if (activeDecoder === 'no') decoder = '软件解码';
  else if (activeDecoder) {
    const api = activeDecoder.replace(/-copy$/, '');
    const name =
      (
        {
          videotoolbox: 'VideoToolbox',
          mediacodec: 'MediaCodec',
          nvdec: 'NVDEC',
          vaapi: 'VAAPI',
          d3d11va: 'D3D11VA',
          dxva2: 'DXVA2',
        } as Record<string, string>
      )[api] ?? api;
    decoder = `硬解 · ${name}${activeDecoder.endsWith('-copy') ? '（拷贝）' : ''}`;
  }
  badges.push({ key: 'decoder', text: decoder, accessibilityLabel: `本机视频解码：${decoder}` });
  // Metadata describes the original file. Never show it as the decoded resolution/bitrate of a transcode.
  const direct = source.method === 'directPlay';
  const hasNativeResolution = positive(info?.width) && positive(info?.height);
  const width = hasNativeResolution ? info.width : direct ? source.sourceWidth : undefined;
  const height = hasNativeResolution ? info.height : direct ? source.sourceHeight : undefined;
  if (positive(width) && positive(height))
    badges.push({
      key: 'resolution',
      text: `${width}×${height}`,
      compactText: width >= height ? `${height}p` : `${width}×${height}`,
      accessibilityLabel: `分辨率：${width} × ${height}`,
    });
  const codec = codecLabel(info?.videoCodec || (direct ? source.sourceCodec : undefined));
  const fps = positive(info?.fps) ? info.fps : direct ? source.sourceFps : undefined;
  const format = [codec, positive(fps) ? `${Number(fps.toFixed(2))} fps` : undefined]
    .filter(Boolean)
    .join(' · ');
  if (format)
    badges.push({
      key: 'format',
      text: format,
      compactText: codec,
      accessibilityLabel: `视频格式：${format}`,
    });
  // The compact overlay describes the original file, not a moving packet-rate estimate.
  const sourceBitrate = positive(source.sourceVideoBitrate)
    ? source.sourceVideoBitrate
    : source.sourceBitrate;
  badges.push({
    key: 'bitrate',
    text: positive(sourceBitrate) ? `源码率 ${bitrateLabel(sourceBitrate)}` : '源码率未知',
    accessibilityLabel: positive(sourceBitrate)
      ? `源文件${positive(source.sourceVideoBitrate) ? '视频' : '总'}码率：${bitrateLabel(sourceBitrate)}`
      : '服务器未提供源文件码率',
  });
  if (positive(info?.videoBitrate)) {
    const bitrate = info.videoBitrate + (positive(info.audioBitrate) ? info.audioBitrate : 0);
    badges.push({
      key: 'currentBitrate',
      text: `实时码率 ${bitrateLabel(bitrate)}`,
      accessibilityLabel: `当前音视频估算码率：${bitrateLabel(bitrate)}`,
    });
  }
  if (!direct && source.method !== 'pending' && positive(source.bitrateLimit)) {
    badges.push({
      key: 'bitrateLimit',
      text: `上限 ${bitrateLabel(source.bitrateLimit)}`,
      accessibilityLabel: `请求的音视频码率上限：${bitrateLabel(source.bitrateLimit)}`,
    });
  }
  const audio = codecLabel(info?.audioCodec);
  if (audio) badges.push({ key: 'audio', text: audio, accessibilityLabel: `音频编码：${audio}` });
  return badges;
}

/** Keep the overlay quiet; the complete values remain available in playback details. */
export function derivePlaybackInfoSummary(badges: PlaybackInfoBadge[]): PlaybackInfoBadge[] {
  return ['method', 'format', 'resolution', 'decoder', 'bitrate'].flatMap((key) => {
    const badge = badges.find((entry) => entry.key === key);
    if (!badge) return [];
    let text = badge.text;
    if (key === 'method') {
      // A remux or copied video does not establish that the server decoded it.
      if (text === '服务器转码') text = '转码';
      else if (text !== '音频转码') return [];
    } else if (key === 'format') {
      if (!badge.compactText) return [];
      return [
        { ...badge, text: badge.compactText, accessibilityLabel: `视频编码：${badge.compactText}` },
      ];
    } else if (key === 'resolution') {
      if (!badge.compactText) return [];
      text = badge.compactText;
    } else if (key === 'decoder') {
      text = text.startsWith('硬解') ? 'HW' : text === '软件解码' ? 'SW' : '—';
    } else {
      text = text
        .replace(/^码率 /, '')
        .replace(/^源码率 /, '')
        .replace(/^上限 /, '≤')
        .replace(' Mbps', 'M')
        .replace(' Kbps', 'K')
        .replace('源码率未知', '—')
        .replace('码率待确认', '—');
    }
    return [{ ...badge, text }];
  });
}
