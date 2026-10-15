import { describe, expect, it } from 'vitest';

import { generateDeviceProfile } from './native';

describe('MPV transcoding negotiation', () => {
  it('advertises HEVC with H.264 fallback, never AV1 when HEVC was selected', () => {
    const profile = generateDeviceProfile({ transcode: true, codec: 'h265', maxBitrate: 1000000 });
    expect(profile.TranscodingProfiles[0].VideoCodec).toBe('hevc,h264');
    expect(profile.MaxStreamingBitrate).toBe(1000000);
    expect(profile.DirectPlayProfiles.length).toBeGreaterThan(0);
  });

  it('requests external text subtitles for MPV alongside transcoded video', () => {
    const profile = generateDeviceProfile({ transcode: true });
    expect(profile.SubtitleProfiles).toContainEqual({ Format: 'srt', Method: 'External' });
    expect(profile.SubtitleProfiles).toContainEqual({ Format: 'ass', Method: 'External' });
    expect(profile.SubtitleProfiles.some((entry) => entry.Method === 'Hls')).toBe(false);
    expect(
      generateDeviceProfile({ transcode: true, subtitleBurnIn: true }).SubtitleProfiles,
    ).toContainEqual({ Format: 'ass', Method: 'Encode' });
  });
});
