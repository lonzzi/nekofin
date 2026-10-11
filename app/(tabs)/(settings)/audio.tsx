import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsTitle } from '@/components/ui/SettingsVisual';
import { storage } from '@/lib/storage';
import { useState } from 'react';

const languages = [
  { title: '跟随影片', value: 'auto' },
  { title: '中文', value: 'zh' },
  { title: '英语', value: 'en' },
  { title: '日语', value: 'ja' },
  { title: '韩语', value: 'ko' },
];
export default function AudioSettings() {
  const [audio, setAudio] = useState(storage.getString('playback.audioLanguage') ?? 'auto');
  const [subtitle, setSubtitle] = useState(
    storage.getString('playback.subtitleLanguage') ?? 'auto',
  );
  const [enabled, setEnabled] = useState(storage.getBoolean('playback.subtitlesEnabled') ?? true);
  return (
    <>
      <OuterTitle>音频与字幕</OuterTitle>
      <NativeSettingsForm>
        <NativeSettingsSection title="音频">
          <NativeSettingsPicker
            title={<SettingsTitle>首选音轨语言</SettingsTitle>}
            value={audio}
            options={languages}
            onValueChange={(v) => {
              setAudio(v);
              storage.set('playback.audioLanguage', v);
            }}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title="字幕">
          <NativeSettingsSwitch
            title={<SettingsTitle>默认显示字幕</SettingsTitle>}
            value={enabled}
            onValueChange={(v) => {
              setEnabled(v);
              storage.set('playback.subtitlesEnabled', v);
            }}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>首选字幕语言</SettingsTitle>}
            value={subtitle}
            disabled={!enabled}
            options={languages}
            onValueChange={(v) => {
              setSubtitle(v);
              storage.set('playback.subtitleLanguage', v);
            }}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
