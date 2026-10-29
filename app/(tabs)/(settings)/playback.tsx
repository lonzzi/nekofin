import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { usePlayerGestureSettings } from '@/hooks/usePlayerGestureSettings';
import { useTranslation } from '@/lib/i18n';
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
  const { t: tr } = useTranslation();
  const {
    brightnessGestureEnabled,
    setBrightnessGestureEnabled,
    volumeGestureEnabled,
    setVolumeGestureEnabled,
    seekGestureEnabled,
    setSeekGestureEnabled,
  } = usePlayerGestureSettings();
  const [autoPlayNext = true, setAutoPlayNext] = useMMKVBoolean('playback.autoPlayNext', storage);
  const [autoSkipIntro = false, setAutoSkipIntro] = useMMKVBoolean(
    'playback.autoSkipIntro',
    storage,
  );
  const [autoSkipOutro = false, setAutoSkipOutro] = useMMKVBoolean(
    'playback.autoSkipOutro',
    storage,
  );
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
      <OuterTitle>{tr('settings.playbackAndQuality')}</OuterTitle>
      <NativeSettingsForm testID="playback-settings-form">
        <NativeSettingsSection title={tr('settings.playbackDefaults')}>
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.autoPlayNextEpisode')}</SettingsTitle>}
            value={autoPlayNext}
            onValueChange={setAutoPlayNext}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('player.orientation')}</SettingsTitle>}
            value={orientation}
            options={[
              { title: tr('player.landscape'), value: 'landscape' },
              { title: tr('player.portrait'), value: 'portrait' },
              { title: tr('settings.system'), value: 'auto' },
            ]}
            onValueChange={(v) => {
              setOrientation(v);
              storage.set('videoOrientation', v);
            }}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('player.defaultPlaybackSpeed')}</SettingsTitle>}
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
        <NativeSettingsSection title={tr('player.gestureControls')}>
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.brightnessGesture')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={tr('player.brightnessGestureDescription')} />}
            value={brightnessGestureEnabled}
            onValueChange={setBrightnessGestureEnabled}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.volumeGesture')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={tr('player.volumeGestureDescription')} />}
            value={volumeGestureEnabled}
            onValueChange={setVolumeGestureEnabled}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.seekGesture')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={tr('player.seekGestureDescription')} />}
            value={seekGestureEnabled}
            onValueChange={setSeekGestureEnabled}
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title={tr('player.segmentSkipping')}
          footer={tr('player.segmentSkippingDescription')}
        >
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.autoSkipIntro')}</SettingsTitle>}
            value={autoSkipIntro}
            onValueChange={setAutoSkipIntro}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.autoSkipOutro')}</SettingsTitle>}
            value={autoSkipOutro}
            onValueChange={setAutoSkipOutro}
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title={tr('player.qualityAndCompatibility')}
          footer={tr('player.customTranscodingDescription')}
        >
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.customTranscoding')}</SettingsTitle>}
            value={enableTranscoding}
            onValueChange={handleTranscodingToggle}
          />
          <NativeSettingsPicker
            disabled={!enableTranscoding}
            title={<SettingsTitle>{tr('player.maximumBitrate')}</SettingsTitle>}
            value={maxBitrate.toString()}
            options={bitrateOptions}
            onValueChange={handleBitrateChange}
          />
          <NativeSettingsPicker
            disabled={!enableTranscoding}
            title={<SettingsTitle>{tr('media.videoCodec')}</SettingsTitle>}
            value={selectedCodec}
            options={codecOptions}
            onValueChange={handleCodecSelection}
          />
          <NativeSettingsSwitch
            disabled={!enableTranscoding}
            title={<SettingsTitle>{tr('player.burnInSubtitles')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={tr('player.subtitleBurnInDescription')} />}
            value={enableSubtitleBurnIn}
            onValueChange={handleSubtitleBurnInToggle}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
