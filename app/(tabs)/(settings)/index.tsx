import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { SettingsTitle } from '@/components/ui/SettingsVisual';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useThemePreference, type ThemePreference } from '@/lib/contexts/ThemePreferenceContext';
import { useTranslation } from '@/lib/i18n';
import type { LanguagePreference } from '@/lib/i18n/language';
import { useLanguagePreference } from '@/lib/i18n/LanguageProvider';

export default function SettingsScreen() {
  const { t: tr } = useTranslation();
  const router = useTracedRouter('settings');
  const { themePreference, setThemePreference } = useThemePreference();
  const { languagePreference, setLanguagePreference } = useLanguagePreference();
  return (
    <>
      <OuterTitle>{tr('navigation.settings')}</OuterTitle>
      <NativeSettingsForm testID="settings-form">
        <NativeSettingsSection title={tr('settings.viewingExperience')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('settings.playbackAndQuality')}</SettingsTitle>}
            disclosure
            onPress={() => router.push('/playback')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('settings.audioAndSubtitles')}</SettingsTitle>}
            disclosure
            onPress={() => router.push('/audio')}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('danmaku.comments')}</SettingsTitle>}
            disclosure
            onPress={() => router.push('/danmaku')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('settings.app')}>
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('settings.language')}</SettingsTitle>}
            value={languagePreference}
            options={[
              { title: tr('settings.system'), value: 'system' },
              { title: tr('settings.languageSimplifiedChinese'), value: 'zh-Hans' },
              { title: 'English', value: 'en' },
            ]}
            onValueChange={(value) => setLanguagePreference(value as LanguagePreference)}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('settings.appearance')}</SettingsTitle>}
            value={themePreference}
            options={[
              { title: tr('settings.system'), value: 'system' },
              { title: tr('settings.themeLight'), value: 'light' },
              { title: tr('settings.themeDark'), value: 'dark' },
            ]}
            onValueChange={(value) => setThemePreference(value as ThemePreference)}
          />
          <NativeSettingsItem
            title={<SettingsTitle>{tr('settings.storage')}</SettingsTitle>}
            disclosure
            onPress={() => router.push('/cache')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('settings.support')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('about.helpAndAbout')}</SettingsTitle>}
            disclosure
            onPress={() => router.push('/about')}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
