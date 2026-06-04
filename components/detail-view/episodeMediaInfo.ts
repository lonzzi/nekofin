import { formatBitrate } from '@/lib/utils/format';
import { MediaSource, MediaStream } from '@/services/media/types';

export interface MediaInfoRow {
  label: string;
  value: string;
}

export const calculateAspectRatio = (
  width?: number | null,
  height?: number | null,
): string | null => {
  if (!width || !height) return null;

  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3';
  if (Math.abs(ratio - 21 / 9) < 0.01) return '21:9';
  if (Math.abs(ratio - 1) < 0.01) return '1:1';

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

export const getResolutionLabel = (height?: number | null): string | null => {
  if (!height) return null;

  if (height === 720) return '720p';
  if (height === 1080) return '1080p';
  if (height === 1440) return '1440p';
  if (height === 2160) return '2160p';

  return `${height}p`;
};

export const getFirstMediaStream = (
  source: MediaSource,
  type: MediaStream['type'],
): MediaStream | undefined => source.mediaStreams.find((stream) => stream.type === type);

export const getVideoInfoRows = (source: MediaSource): MediaInfoRow[] => {
  const videoStream = getFirstMediaStream(source, 'Video');
  if (!videoStream) return [];

  const resolution =
    videoStream.width && videoStream.height ? `${videoStream.width}x${videoStream.height}` : null;
  const frameRate = videoStream.averageFrameRate || videoStream.realFrameRate;
  const aspectRatio =
    videoStream.aspectRatio || calculateAspectRatio(videoStream.width, videoStream.height);
  const titleParts = [
    getResolutionLabel(videoStream.height),
    videoStream.codec?.toUpperCase(),
    videoStream.videoRange || 'SDR',
  ].filter(Boolean);

  return [
    titleParts.length > 0 ? { label: '标题', value: titleParts.join(' ') } : null,
    { label: '语言', value: videoStream.language || 'Unknown language' },
    { label: '编码', value: videoStream.codec || '未知' },
    resolution ? { label: '分辨率', value: resolution } : null,
    frameRate ? { label: '帧率', value: frameRate.toFixed(6) } : null,
    videoStream.bitRate ? { label: '比特率', value: formatBitrate(videoStream.bitRate) } : null,
    { label: '动态范围', value: videoStream.videoRange || 'Unknown' },
    videoStream.profile ? { label: '配置', value: videoStream.profile } : null,
    videoStream.level !== null && videoStream.level !== undefined
      ? { label: '等级', value: videoStream.level.toFixed(1) }
      : null,
    aspectRatio ? { label: '长宽比', value: aspectRatio } : null,
    { label: '交错', value: videoStream.isInterlaced ? '是' : '否' },
    videoStream.bitDepth ? { label: '位深', value: String(videoStream.bitDepth) } : null,
    videoStream.pixelFormat ? { label: '像素格式', value: videoStream.pixelFormat } : null,
  ].filter((row): row is MediaInfoRow => row !== null);
};

export const getAudioInfoRows = (source: MediaSource): MediaInfoRow[] => {
  const audioStream = getFirstMediaStream(source, 'Audio');
  if (!audioStream) return [];

  const titleParts = [
    audioStream.language || 'Unknown',
    audioStream.title ? `- ${audioStream.title}` : null,
  ].filter(Boolean);

  return [
    titleParts.length > 0 ? { label: '标题', value: titleParts.join(' ') } : null,
    { label: '语言', value: audioStream.language || 'Unknown language' },
    { label: '布局', value: audioStream.channelLayout || 'Unknown' },
    audioStream.channels ? { label: '声道', value: String(audioStream.channels) } : null,
    { label: '编码', value: audioStream.codec || '未知' },
    audioStream.bitRate ? { label: '比特率', value: formatBitrate(audioStream.bitRate) } : null,
    audioStream.sampleRate ? { label: '采样率', value: `${audioStream.sampleRate}Hz` } : null,
    { label: '动态范围', value: 'Unknown' },
    audioStream.audioProfile ? { label: '配置', value: audioStream.audioProfile } : null,
    audioStream.level !== null && audioStream.level !== undefined
      ? { label: '等级', value: audioStream.level.toFixed(1) }
      : null,
    { label: '外部', value: '否' },
    { label: '默认', value: audioStream.isDefault ? '是' : '否' },
  ].filter((row): row is MediaInfoRow => row !== null);
};
