/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import MediaTypes from '../../constants/MediaTypes';
import { getSubtitleProfiles } from './subtitles';

const getCodecConfig = (codec) => {
  const codecConfigs = {
    h264: { videoCodec: 'h264', container: 'ts' },
    h265: { videoCodec: 'hevc,h264', container: 'ts' },
    vp9: { videoCodec: 'vp9', container: 'webm' },
    av1: { videoCodec: 'av1', container: 'webm' },
  };
  return codecConfigs[codec] || codecConfigs.h264;
};

export const generateDeviceProfile = ({
  transcode = false,
  maxBitrate = 999_999_999,
  subtitleBurnIn = false,
  codec = 'h264',
} = {}) => {
  /**
   * Device profile for Native video player
   */
  const codecConfig = getCodecConfig(codec);
  const profile = {
    Name: `NekoFin MPV${transcode ? ' (Transcoding)' : ''}`,
    MaxStaticBitrate: maxBitrate,
    MaxStreamingBitrate: maxBitrate,
    CodecProfiles: [
      {
        Type: MediaTypes.Video,
        Codec: 'h264,mpeg4,divx,xvid,wmv,vc1,vp8,vp9,av1',
      },
      {
        Type: MediaTypes.Video,
        Codec: 'hevc,h265',
        Conditions: [
          {
            Condition: 'LessThanEqual',
            Property: 'VideoLevel',
            Value: '153',
            IsRequired: false,
          },
          {
            Condition: 'NotEquals',
            Property: 'VideoRangeType',
            Value: 'DOVI', //no dolby vision at all
            IsRequired: true,
          },
        ],
      },
      {
        Type: MediaTypes.Audio,
        Codec: 'aac,ac3,eac3,mp3,flac,alac,opus,vorbis,pcm,wma',
      },
    ],
    DirectPlayProfiles: [
      {
        Type: MediaTypes.Video,
        Container: 'mp4,mkv,avi,mov,flv,ts,m2ts,webm,ogv,3gp,hls',
        VideoCodec: 'h264,hevc,mpeg4,divx,xvid,wmv,vc1,vp8,vp9,av1,avi,mpeg,mpeg2video',
        AudioCodec: 'aac,ac3,eac3,mp3,flac,alac,opus,vorbis,wma,dts',
      },
      {
        Type: MediaTypes.Audio,
        Container: 'mp3,aac,flac,alac,wav,ogg,wma',
        AudioCodec: 'mp3,aac,flac,alac,opus,vorbis,wma,pcm,mpa,wav,ogg,oga,webma,ape',
      },
    ],
    TranscodingProfiles: [
      {
        Type: MediaTypes.Video,
        Context: 'Streaming',
        Protocol: codecConfig.container === 'webm' ? 'http' : 'hls',
        Container: codecConfig.container,
        VideoCodec: codecConfig.videoCodec,
        AudioCodec: codecConfig.container === 'webm' ? 'opus,vorbis' : 'aac,mp3,ac3,dts',
      },
      {
        Type: MediaTypes.Audio,
        Context: 'Streaming',
        Protocol: 'http',
        Container: 'mp3',
        AudioCodec: 'mp3',
        MaxAudioChannels: '2',
      },
    ],
    // MPV loads text subtitles separately even when the video is transcoded.
    // HLS subtitle renditions are not the external text files used by sub-add.
    SubtitleProfiles: getSubtitleProfiles('External', subtitleBurnIn),
  };

  return profile;
};
