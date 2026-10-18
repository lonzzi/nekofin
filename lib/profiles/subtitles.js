/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const COMMON_SUBTITLE_PROFILES = [
  // Official formats

  { Format: 'dvdsub', Method: 'Embed' },
  { Format: 'dvdsub', Method: 'Encode' },

  { Format: 'idx', Method: 'Embed' },
  { Format: 'idx', Method: 'Encode' },

  { Format: 'teletext', Method: 'Embed' },
  { Format: 'teletext', Method: 'Encode' },
];

const VARYING_SUBTITLE_FORMATS = [
  'pgs',
  'pgssub',
  'hdmv_pgs_subtitle',
  'sup',
  'webvtt',
  'vtt',
  'srt',
  'subrip',
  'ttml',
  'ass',
  'ssa',
  'microdvd',
  'mov_text',
  'mpl2',
  'pjs',
  'realtext',
  'scc',
  'smi',
  'stl',
  'sub',
  'subviewer',
  'text',
  'vplayer',
  'xsub',
];

export const getSubtitleProfiles = (secondaryMethod, subtitleBurnIn = false) => {
  const profiles = [...COMMON_SUBTITLE_PROFILES];
  for (const format of VARYING_SUBTITLE_FORMATS) {
    profiles.push({ Format: format, Method: 'Embed' });
    profiles.push({ Format: format, Method: subtitleBurnIn ? 'Encode' : secondaryMethod });
  }
  return profiles;
};
