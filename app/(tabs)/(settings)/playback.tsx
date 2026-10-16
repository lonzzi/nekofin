import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { storage } from '@/lib/storage';
import { useState } from 'react';
import { useMMKVBoolean } from 'react-native-mmkv';

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

export default function PlaybackSettings() {
  const [autoPlayNext = true, setAutoPlayNext] = useMMKVBoolean('playback.autoPlayNext', storage);
  const [orientation, setOrientation] = useState(
    storage.getString('videoOrientation') ?? 'landscape',
  );
  const [rate, setRate] = useState(String(storage.getNumber('playback.defaultRate') ?? 1));
  const [enableTranscoding, setEnableTranscoding] = useState(
    storage.getBoolean('enableTranscoding') ?? false,
  );
  const [maxBitrate, setMaxBitrate] = useState(storage.getNumber('maxBitrate') ?? 20000000);
  const [enableSubtitleBurnIn, setEnableSubtitleBurnIn] = useState(
    storage.getBoolean('enableSubtitleBurnIn') ?? false,
  );
  const [selectedCodec, setSelectedCodec] = useState(storage.getString('selectedCodec') ?? 'h264');

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
    <>
      <OuterTitle>播放与画质</OuterTitle>
      <NativeSettingsForm testID="playback-settings-form">
        <NativeSettingsSection title="播放默认值">
          <NativeSettingsSwitch
            title={<SettingsTitle>自动播放下一集</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="本集播放结束后自动继续下一集。" lines={2} />}
            value={autoPlayNext}
            onValueChange={setAutoPlayNext}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>屏幕方向</SettingsTitle>}
            value={orientation}
            options={[
              { title: '横屏', value: 'landscape' },
              { title: '竖屏', value: 'portrait' },
              { title: '跟随系统', value: 'auto' },
            ]}
            onValueChange={(v) => {
              setOrientation(v);
              storage.set('videoOrientation', v);
            }}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>默认倍速</SettingsTitle>}
            value={rate}
            options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => ({
              title: `${v}×`,
              value: String(v),
            }))}
            onValueChange={(v) => {
              setRate(v);
              storage.set('playback.defaultRate', Number(v));
            }}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="画质与兼容性">
          <NativeSettingsSwitch
            title={<SettingsTitle>自定义转码</SettingsTitle>}
            subtitle={
              <SettingsSubtitle primary="设置码率和转码格式，兼容时仍优先直接播放。" lines={2} />
            }
            value={enableTranscoding}
            onValueChange={handleTranscodingToggle}
          />
          <NativeSettingsPicker
            disabled={!enableTranscoding}
            title={<SettingsTitle>最大码率</SettingsTitle>}
            value={maxBitrate.toString()}
            options={bitrateOptions}
            onValueChange={handleBitrateChange}
          />
          <NativeSettingsPicker
            disabled={!enableTranscoding}
            title={<SettingsTitle>视频编码</SettingsTitle>}
            value={selectedCodec}
            options={codecOptions}
            onValueChange={handleCodecSelection}
          />
          <NativeSettingsSwitch
            disabled={!enableTranscoding}
            title={<SettingsTitle>字幕烧录</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="字幕合入画面，增加转码负载。" />}
            value={enableSubtitleBurnIn}
            onValueChange={handleSubtitleBurnInToggle}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
