import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useCustomSubtitleFonts } from '@/hooks/useCustomSubtitleFonts';
import { storage } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';

const languages = [
  { title: '跟随影片', value: 'auto' },
  { title: '中文', value: 'zh' },
  { title: '英语', value: 'en' },
  { title: '日语', value: 'ja' },
  { title: '韩语', value: 'ko' },
];
export default function AudioSettings() {
  const router = useRouter();
  const { selected } = useCustomSubtitleFonts();
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
        <NativeSettingsSection
          title="字幕"
          footer={!enabled ? '开启“默认显示字幕”后可设置首选语言。' : undefined}
        >
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
        <NativeSettingsSection title="字体">
          <NativeSettingsItem
            title={<SettingsTitle>字幕字体</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={selected?.family ?? '跟随字幕与服务器'} />}
            disclosure
            onPress={() => router.push('/subtitle-fonts')}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
