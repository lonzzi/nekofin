import { t as tr } from '@/lib/i18n';
import { formatBitrate } from '@/lib/utils/format';
import { MediaSource, MediaStream } from '@/services/media/types';

export interface MediaInfoRow {
  label: string;
  value: string;
}

export function getMediaInfoDisplayState({
  mediaSources,
  isPending,
  isError,
}: {
  mediaSources: MediaSource[];
  isPending: boolean;
  isError: boolean;
}) {
  if (isPending) return 'loading';
  if (
    mediaSources.some((source) =>
      source.mediaStreams.some((stream) => stream.type === 'Video' || stream.type === 'Audio'),
    )
  ) {
    return 'ready';
  }
  return isError ? 'error' : 'empty';
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
    titleParts.length > 0 ? { label: tr('media.title'), value: titleParts.join(' ') } : null,
    { label: tr('settings.language'), value: videoStream.language || 'Unknown language' },
    { label: tr('media.codec'), value: videoStream.codec || tr('common.unknown') },
    resolution ? { label: tr('media.resolution'), value: resolution } : null,
    frameRate ? { label: tr('diagnostics.frameRate'), value: frameRate.toFixed(6) } : null,
    videoStream.bitRate
      ? { label: tr('media.bitrate'), value: formatBitrate(videoStream.bitRate) }
      : null,
    { label: tr('media.dynamicRange'), value: videoStream.videoRange || 'Unknown' },
    videoStream.profile ? { label: tr('media.profile'), value: videoStream.profile } : null,
    videoStream.level !== null && videoStream.level !== undefined
      ? { label: tr('media.level'), value: videoStream.level.toFixed(1) }
      : null,
    aspectRatio ? { label: tr('player.aspectRatio'), value: aspectRatio } : null,
    {
      label: tr('media.interlaced'),
      value: videoStream.isInterlaced ? tr('common.yes') : tr('common.no'),
    },
    videoStream.bitDepth
      ? { label: tr('media.bitDepth'), value: String(videoStream.bitDepth) }
      : null,
    videoStream.pixelFormat
      ? { label: tr('media.pixelFormat'), value: videoStream.pixelFormat }
      : null,
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
    titleParts.length > 0 ? { label: tr('media.title'), value: titleParts.join(' ') } : null,
    { label: tr('settings.language'), value: audioStream.language || 'Unknown language' },
    { label: tr('media.channelLayout'), value: audioStream.channelLayout || 'Unknown' },
    audioStream.channels
      ? { label: tr('media.channels'), value: String(audioStream.channels) }
      : null,
    { label: tr('media.codec'), value: audioStream.codec || tr('common.unknown') },
    audioStream.bitRate
      ? { label: tr('media.bitrate'), value: formatBitrate(audioStream.bitRate) }
      : null,
    audioStream.sampleRate
      ? { label: tr('media.sampleRate'), value: `${audioStream.sampleRate}Hz` }
      : null,
    { label: tr('media.dynamicRange'), value: 'Unknown' },
    audioStream.audioProfile
      ? { label: tr('media.profile'), value: audioStream.audioProfile }
      : null,
    audioStream.level !== null && audioStream.level !== undefined
      ? { label: tr('media.level'), value: audioStream.level.toFixed(1) }
      : null,
    { label: tr('player.externalTrack'), value: tr('common.no') },
    {
      label: tr('common.default'),
      value: audioStream.isDefault ? tr('common.yes') : tr('common.no'),
    },
  ].filter((row): row is MediaInfoRow => row !== null);
};
