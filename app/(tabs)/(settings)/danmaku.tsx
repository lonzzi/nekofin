import { OuterTitle } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSlider,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { defaultSettings, useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export default function DanmakuSettingsScreen() {
  const { t: tr } = useTranslation();
  const { settings, setSettings } = useDanmakuSettings();
  const { sources } = useDanmakuSources();
  const router = useRouter();

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 36;
  const FONT_SIZE_RANGE = FONT_SIZE_MAX - FONT_SIZE_MIN;

  const mapFontSizeToSlider = (fontSize: number) => (fontSize - FONT_SIZE_MIN) / FONT_SIZE_RANGE;
  const mapSliderToFontSize = (sliderValue: number) =>
    Math.round(FONT_SIZE_MIN + sliderValue * FONT_SIZE_RANGE);

  const toggleFilter = (bit: number) => {
    setSettings((current) => ({
      ...current,
      danmakuFilter: current.danmakuFilter ^ bit,
    }));
  };

  const toggleModeFilter = (bit: number) => {
    setSettings((current) => ({
      ...current,
      danmakuModeFilter: current.danmakuModeFilter ^ bit,
    }));
  };

  const handleResetToDefault = () => {
    Alert.alert(tr('danmaku.resetConfirmation'), tr('danmaku.resetSettingsDescription'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('common.restoreDefaults'),
        style: 'destructive',
        onPress: () => setSettings(defaultSettings),
      },
    ]);
  };

  return (
    <>
      <OuterTitle>{tr('danmaku.settings')}</OuterTitle>
      <NativeSettingsForm testID="danmaku-settings-form">
        <NativeSettingsSection title={tr('danmaku.apis')}>
          <NativeSettingsItem
            title={<SettingsTitle>{tr('danmaku.manageApis')}</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={tr('danmaku.enabledApiCount', {
                  count: sources.filter((source) => source.enabled).length,
                })}
              />
            }
            disclosure
            onPress={() => router.push('/(tabs)/(settings)/danmaku-sources')}
          />
        </NativeSettingsSection>
        <NativeSettingsSection title={tr('settings.display')}>
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.showComments')}</SettingsTitle>}
            value={settings.enabled}
            onValueChange={(value) => updateSetting('enabled', value)}
          />
          <NativeSettingsSlider
            title={<SettingsTitle>{tr('danmaku.opacity')}</SettingsTitle>}
            value={settings.opacity}
            min={0.1}
            max={1.0}
            step={0.05}
            onValueChange={(value) => updateSetting('opacity', value)}
            formatValue={(value) => `${Math.round(value * 100)}%`}
          />
          <NativeSettingsSlider
            title={<SettingsTitle>{tr('fonts.fontSize')}</SettingsTitle>}
            value={mapFontSizeToSlider(settings.fontSize)}
            min={0}
            max={1}
            step={1 / FONT_SIZE_RANGE}
            onValueChange={(value) => updateSetting('fontSize', mapSliderToFontSize(value))}
            formatValue={(value) => `${mapSliderToFontSize(value)}px`}
          />
          <NativeSettingsSlider
            title={<SettingsTitle>{tr('danmaku.displayArea')}</SettingsTitle>}
            value={settings.heightRatio}
            min={0.3}
            max={1.0}
            step={0.05}
            onValueChange={(value) => updateSetting('heightRatio', value)}
            formatValue={(value) => `${Math.round(value * 100)}%`}
          />
        </NativeSettingsSection>

        <NativeSettingsSection
          title={tr('danmaku.speedAndDensity')}
          footer={!settings.enabled ? tr('danmaku.enableToAdjustHint') : undefined}
        >
          <NativeSettingsSlider
            title={<SettingsTitle>{tr('danmaku.scrollSpeed')}</SettingsTitle>}
            value={Math.max(80, Math.min(240, settings.speed))}
            min={80}
            max={240}
            step={10}
            disabled={!settings.enabled}
            onValueChange={(value) => updateSetting('speed', Math.round(value))}
            formatValue={(value) => `${Math.round(value)} px/s`}
          />
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('danmaku.density')}</SettingsTitle>}
            value={String(settings.danmakuDensityLimit)}
            disabled={!settings.enabled}
            options={[
              { title: tr('common.auto'), value: '0' },
              { title: tr('danmaku.relaxedMatching'), value: '1' },
              { title: tr('diagnostics.standard'), value: '2' },
              { title: tr('danmaku.strictMatching'), value: '3' },
              { title: tr('diagnostics.minimal'), value: '4' },
            ]}
            onValueChange={(value) => updateSetting('danmakuDensityLimit', Number(value))}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.preventOverlap')}</SettingsTitle>}
            value={settings.collisionPolicy === 'avoid'}
            disabled={!settings.enabled}
            onValueChange={(value) => updateSetting('collisionPolicy', value ? 'avoid' : 'allow')}
          />
        </NativeSettingsSection>

        <NativeSettingsSection title={tr('diagnostics.timing')}>
          <NativeSettingsSlider
            title={<SettingsTitle>{tr('danmaku.offset')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={tr('danmaku.offsetDescription')} />}
            value={Math.max(-5, Math.min(5, settings.curEpOffset))}
            min={-5}
            max={5}
            step={0.5}
            disabled={!settings.enabled}
            onValueChange={(value) => updateSetting('curEpOffset', value)}
            formatValue={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}s`}
          />
          {settings.curEpOffset !== 0 ? (
            <NativeSettingsItem
              title={
                <SettingsActionTitle tone="accent">{tr('danmaku.resetOffset')}</SettingsActionTitle>
              }
              onPress={() => updateSetting('curEpOffset', 0)}
            />
          ) : null}
        </NativeSettingsSection>

        <NativeSettingsSection title={tr('danmaku.sourceFilters')}>
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.bilibili')}</SettingsTitle>}
            value={(settings.danmakuFilter & 1) !== 1}
            onValueChange={() => toggleFilter(1)}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.bahamut')}</SettingsTitle>}
            value={(settings.danmakuFilter & 2) !== 2}
            onValueChange={() => toggleFilter(2)}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.dandanplay')}</SettingsTitle>}
            value={(settings.danmakuFilter & 4) !== 4}
            onValueChange={() => toggleFilter(4)}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.otherSources')}</SettingsTitle>}
            value={(settings.danmakuFilter & 8) !== 8}
            onValueChange={() => toggleFilter(8)}
          />
        </NativeSettingsSection>

        <NativeSettingsSection title={tr('danmaku.types')}>
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.bottomComments')}</SettingsTitle>}
            value={(settings.danmakuModeFilter & 1) !== 1}
            onValueChange={() => toggleModeFilter(1)}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.topComments')}</SettingsTitle>}
            value={(settings.danmakuModeFilter & 2) !== 2}
            onValueChange={() => toggleModeFilter(2)}
          />
          <NativeSettingsSwitch
            title={<SettingsTitle>{tr('danmaku.scrollingComments')}</SettingsTitle>}
            value={(settings.danmakuModeFilter & 4) !== 4}
            onValueChange={() => toggleModeFilter(4)}
          />
        </NativeSettingsSection>

        <NativeSettingsSection>
          <NativeSettingsItem
            title={<SettingsActionTitle>{tr('danmaku.restoreDefaults')}</SettingsActionTitle>}
            onPress={handleResetToDefault}
          />
        </NativeSettingsSection>
      </NativeSettingsForm>
    </>
  );
}
