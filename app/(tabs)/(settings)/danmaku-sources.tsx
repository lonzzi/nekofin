import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'expo-router';

export default function DanmakuSourcesScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { sourceSettings, setSourceSettings } = useDanmakuSources();
  return (
    <>
      <OuterTitle>{tr('danmaku.apis')}</OuterTitle>
      <HeaderToolbar placement="right">
        <HeaderButton
          icon={getNativeToolbarIcon('add', 'plus')}
          accessibilityLabel={tr('danmaku.addApi')}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/(settings)/danmaku-source/[id]',
              params: { id: 'new' },
            })
          }
        >
          {tr('common.add')}
        </HeaderButton>
      </HeaderToolbar>
      <NativeSettingsForm testID="danmaku-api-sources">
        <NativeSettingsSection title={tr('danmaku.builtInApi')}>
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.defaultApi')}</SettingsTitle>}
            value={sourceSettings.defaultEnabled}
            onValueChange={(defaultEnabled) =>
              setSourceSettings((current) => ({ ...current, defaultEnabled }))
            }
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('danmaku.customApis')}>
          {sourceSettings.customSources.map((source) => (
            <NativeSettingsItem
              key={source.id}
              title={<SettingsTitle>{source.name}</SettingsTitle>}
              subtitle={
                <SettingsSubtitle
                  primary={
                    new URL(source.baseUrl).host +
                    (source.enabled
                      ? tr('danmaku.sourceEnabledSuffix')
                      : tr('danmaku.sourceDisabledSuffix'))
                  }
                />
              }
              disclosure
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(settings)/danmaku-source/[id]',
                  params: { id: source.id },
                })
              }
            />
          ))}
          {!sourceSettings.customSources.length ? (
            <NativeSettingsItem
              title={<SettingsTitle>{tr('danmaku.noCustomApis')}</SettingsTitle>}
            />
          ) : null}
        </NativeSettingsSection>
        <NativeSettingsSection
          title={tr('danmaku.automaticMatching')}
          footer={tr('danmaku.matchingModesDescription')}
        >
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('danmaku.defaultDisplayMode')}</SettingsTitle>}
            value={sourceSettings.mode}
            options={[
              { title: tr('danmaku.bestMatch'), value: 'auto' },
              { title: tr('danmaku.mergeMatches'), value: 'merge' },
            ]}
            onValueChange={(value) =>
              setSourceSettings((current) => ({
                ...current,
                mode: value === 'merge' ? 'merge' : 'auto',
              }))
            }
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
