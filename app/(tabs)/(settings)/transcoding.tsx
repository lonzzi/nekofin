import {
  NativeSettingsForm,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { storage } from '@/lib/storage';
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

const bitrateOptions = [
  { title: '1 Mbps', value: '1000000' },
  { title: '2 Mbps', value: '2000000' },
  { title: '4 Mbps', value: '4000000' },
  { title: '8 Mbps', value: '8000000' },
  { title: '10 Mbps', value: '10000000' },
  { title: '15 Mbps', value: '15000000' },
  { title: '20 Mbps', value: '20000000' },
  { title: '25 Mbps', value: '25000000' },
  { title: '30 Mbps', value: '30000000' },
  { title: '40 Mbps', value: '40000000' },
  { title: '50 Mbps', value: '50000000' },
  { title: '80 Mbps', value: '80000000' },
  { title: '100 Mbps', value: '100000000' },
];

const codecOptions = [
  { title: 'H.264', value: 'h264' },
  { title: 'H.265/HEVC', value: 'h265' },
];

export default function TranscodingSettingsScreen() {
  const navigation = useNavigation();

  const [enableTranscoding, setEnableTranscoding] = useState(
    storage.getBoolean('enableTranscoding') ?? false,
  );
  const [maxBitrate, setMaxBitrate] = useState(storage.getNumber('maxBitrate') ?? 20000000);
  const [enableSubtitleBurnIn, setEnableSubtitleBurnIn] = useState(
    storage.getBoolean('enableSubtitleBurnIn') ?? false,
  );
  const [selectedCodec, setSelectedCodec] = useState(storage.getString('selectedCodec') ?? 'h264');

  useEffect(() => {
    navigation.setOptions({
      headerLargeTitle: true,
    });
  }, [navigation]);

  const handleBitrateChange = (value: string) => {
    const bitrateValue = parseInt(value, 10);
    setMaxBitrate(bitrateValue);
    storage.set('maxBitrate', bitrateValue);
  };

  const handleTranscodingToggle = (value: boolean) => {
    setEnableTranscoding(value);
    storage.set('enableTranscoding', value);
  };

  const handleSubtitleBurnInToggle = (value: boolean) => {
    setEnableSubtitleBurnIn(value);
    storage.set('enableSubtitleBurnIn', value);
  };

  const handleCodecSelection = (value: string) => {
    setSelectedCodec(value);
    storage.set('selectedCodec', value);
  };

  return (
    <NativeSettingsForm testID="transcoding-settings-form">
      <NativeSettingsSection title="转码设置">
        <NativeSettingsSwitch
          title="启用转码"
          subtitle="当设备无法直接播放时启用转码"
          value={enableTranscoding}
          onValueChange={handleTranscodingToggle}
        />
        <NativeSettingsPicker
          disabled={!enableTranscoding}
          title="最大码率"
          subtitle="设置转码时的最大码率"
          value={maxBitrate.toString()}
          options={bitrateOptions}
          onValueChange={handleBitrateChange}
        />
        <NativeSettingsSwitch
          disabled={!enableTranscoding}
          title="字幕烧录"
          subtitle="转码时将字幕烧录到视频中"
          value={enableSubtitleBurnIn}
          onValueChange={handleSubtitleBurnInToggle}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="编码设置">
        <NativeSettingsPicker
          disabled={!enableTranscoding}
          title="编码器"
          subtitle="选择视频编码器"
          value={selectedCodec}
          options={codecOptions}
          onValueChange={handleCodecSelection}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
