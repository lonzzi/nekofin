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
import { t as tr, useTranslation } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';

const languages = [
  {
    get title() {
      return tr('player.useMediaDefault');
    },
    value: 'auto',
  },
  {
    get title() {
      return tr('settings.languageChinese');
    },
    value: 'zh',
  },
  {
    get title() {
      return tr('settings.languageEnglish');
    },
    value: 'en',
  },
  {
    get title() {
      return tr('settings.languageJapanese');
    },
    value: 'ja',
  },
  {
    get title() {
      return tr('settings.languageKorean');
    },
    value: 'ko',
  },
];
export default function AudioSettings() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { selected } = useCustomSubtitleFonts();
  const [audio, setAudio] = useState(storage.getString('playback.audioLanguage') ?? 'auto');
  const [subtitle, setSubtitle] = useState(
    storage.getString('playback.subtitleLanguage') ?? 'auto',
  );
  const [enabled, setEnabled] = useState(storage.getBoolean('playback.subtitlesEnabled') ?? true);
  return (
    <>
      <OuterTitle>{tr('settings.audioAndSubtitles')}</OuterTitle>
      <NativeSettingsForm>
        <NativeSettingsSection title={tr('media.audio')}>
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('player.preferredAudioLanguage')}</SettingsTitle>}
            value={audio}
            options={languages}
            onValueChange={(v) => {
              setAudio(v);
              storage.set('playback.audioLanguage', v);
            }}
          />
        </NativeSettingsSection>
        <NativeSettingsSection
          title={tr('player.subtitles')}
          footer={!enabled ? tr('player.enableSubtitlesToChooseLanguageHint') : undefined}
        >
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('player.showSubtitlesByDefault')}</SettingsTitle>}
            value={enabled}
            onValueChange={(v) => {
              setEnabled(v);
              storage.set('playback.subtitlesEnabled', v);
            }}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('player.preferredSubtitleLanguage')}</SettingsTitle>}
            value={subtitle}
            disabled={!enabled}
            options={languages}
            onValueChange={(v) => {
              setSubtitle(v);
              storage.set('playback.subtitleLanguage', v);
            }}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('fonts.font')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('fonts.subtitleFonts')}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle primary={selected?.family ?? tr('fonts.useSubtitleOrServerFont')} />
            }
            disclosure
            onPress={() => router.push('/subtitle-fonts')}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
