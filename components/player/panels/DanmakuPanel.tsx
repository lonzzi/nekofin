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
  SettingsSymbol,
  SettingsTitle,
} from '@/components/ui/SettingsVisual';
import { defaultSettings, useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { t as tr, useTranslation } from '@/lib/i18n';
import { useCallback } from 'react';

import { usePlayer } from '../PlayerContext';

type DanmakuPanelProps = {
  onSearch: () => void;
};

const densityProfiles = [
  {
    get title() {
      return tr('common.auto');
    },
    value: '0',
  },
  {
    get title() {
      return tr('danmaku.relaxedMatching');
    },
    value: '1',
  },
  {
    get title() {
      return tr('diagnostics.standard');
    },
    value: '2',
  },
  {
    get title() {
      return tr('danmaku.strictMatching');
    },
    value: '3',
  },
  {
    get title() {
      return tr('diagnostics.minimal');
    },
    value: '4',
  },
];

const sourceFilters = [
  {
    bit: 1,
    get label() {
      return tr('danmaku.showBilibili');
    },
  },
  {
    bit: 2,
    get label() {
      return tr('danmaku.showBahamut');
    },
  },
  {
    bit: 4,
    get label() {
      return tr('danmaku.showDandanplay');
    },
  },
  {
    bit: 8,
    get label() {
      return tr('danmaku.showOtherSources');
    },
  },
];

const modeFilters = [
  {
    bit: 4,
    get label() {
      return tr('danmaku.showScrollingComments');
    },
  },
  {
    bit: 2,
    get label() {
      return tr('danmaku.showTopComments');
    },
  },
  {
    bit: 1,
    get label() {
      return tr('danmaku.showBottomComments');
    },
  },
];

export function DanmakuPanel({ onSearch }: DanmakuPanelProps) {
  const { t: tr } = useTranslation();
  const {
    danmakuComments,
    danmakuEpisodeInfo,
    danmakuTracks,
    danmakuSelection,
    onDanmakuSelectionChange,
    danmakuFailedSources,
  } = usePlayer();
  const { settings, setSettings } = useDanmakuSettings();

  const updateSetting = useCallback(
    <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [setSettings],
  );
  const updateFilter = useCallback(
    (key: 'danmakuFilter' | 'danmakuModeFilter', bit: number, visible: boolean) => {
      setSettings((current) => ({
        ...current,
        [key]: visible ? current[key] & ~bit : current[key] | bit,
      }));
    },
    [setSettings],
  );

  const matchDescription = danmakuEpisodeInfo
    ? `${danmakuEpisodeInfo.animeTitle} · ${danmakuEpisodeInfo.episodeTitle}`
    : danmakuComments.length > 0
      ? tr('danmaku.loadedCount', { count: danmakuComments.length })
      : tr('danmaku.noMatchForVideo');

  return (
    <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-settings">
      <NativeSettingsSection title={tr('danmaku.currentComments')}>
        <NativeSettingsSwitch
          leading={<SettingsSymbol name="text.bubble" />}
          title={<SettingsTitle>{tr('danmaku.showComments')}</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={matchDescription} lines={2} />}
          value={settings.enabled}
          onValueChange={(enabled) => updateSetting('enabled', enabled)}
        />
        <NativeSettingsItem
          leading={<SettingsSymbol name="magnifyingglass" />}
          title={<SettingsTitle>{tr('danmaku.findComments')}</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={tr('danmaku.searchFormHint')} />}
          disclosure
          onPress={onSearch}
        />
        {danmakuTracks?.length ? (
          <NativeSettingsPicker
            title={<SettingsTitle>{tr('danmaku.sourceSelection')}</SettingsTitle>}
            value={danmakuSelection ?? 'auto'}
            options={[
              { title: tr('player.selectAutomatically'), value: 'auto' },
              { title: tr('danmaku.mergeAllMatches'), value: 'merge' },
              ...danmakuTracks.map((track) => ({
                title: tr('danmaku.sourceResultSummary', {
                  sourceName: track.sourceName,
                  animeTitle: track.animeTitle,
                  count: track.comments.length,
                }),
                value: track.id,
              })),
            ]}
            onValueChange={onDanmakuSelectionChange}
          />
        ) : null}
        {danmakuFailedSources?.length ? (
          <NativeSettingsItem
            title={<SettingsTitle>{tr('danmaku.someSourcesUnavailable')}</SettingsTitle>}
            subtitle={<SettingsSubtitle primary={danmakuFailedSources.join('、')} lines={2} />}
          />
        ) : null}
      </NativeSettingsSection>

      <NativeSettingsSection title={tr('danmaku.appearance')}>
        <NativeSettingsSlider
          title={<SettingsTitle>{tr('danmaku.transparency')}</SettingsTitle>}
          value={settings.opacity}
          min={0.1}
          max={1}
          step={0.05}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('opacity', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>{tr('fonts.fontSize')}</SettingsTitle>}
          value={settings.fontSize}
          min={12}
          max={36}
          step={1}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('fontSize', Math.round(value))}
          formatValue={(value) => `${Math.round(value)} px`}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>{tr('danmaku.displayArea')}</SettingsTitle>}
          value={settings.heightRatio}
          min={0.3}
          max={1}
          step={0.05}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('heightRatio', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title={tr('danmaku.motionAndDensity')}>
        <NativeSettingsSlider
          title={<SettingsTitle>{tr('danmaku.scrollSpeed')}</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={tr('danmaku.speedUpLongComments')} />}
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
          subtitle={<SettingsSubtitle primary={tr('danmaku.densityLimitDescription')} />}
          value={String(settings.danmakuDensityLimit)}
          options={densityProfiles}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('danmakuDensityLimit', Number(value))}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>{tr('danmaku.preventOverlap')}</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={tr('danmaku.preventCollisionsDescription')} />}
          value={settings.collisionPolicy === 'avoid'}
          disabled={!settings.enabled}
          onValueChange={(enabled) => updateSetting('collisionPolicy', enabled ? 'avoid' : 'allow')}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>{tr('danmaku.timing')}</SettingsTitle>}
          value={Math.max(-5, Math.min(5, settings.curEpOffset))}
          min={-5}
          max={5}
          step={0.5}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('curEpOffset', value)}
          formatValue={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}s`}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title={tr('danmaku.sources')}>
        {sourceFilters.map(({ bit, label }) => (
          <NativeSettingsSwitch
            key={bit}
            title={<SettingsTitle>{label}</SettingsTitle>}
            value={(settings.danmakuFilter & bit) !== bit}
            disabled={!settings.enabled}
            onValueChange={(visible) => updateFilter('danmakuFilter', bit, visible)}
          />
        ))}
      </NativeSettingsSection>

      <NativeSettingsSection title={tr('danmaku.types')}>
        {modeFilters.map(({ bit, label }) => (
          <NativeSettingsSwitch
            key={bit}
            title={<SettingsTitle>{label}</SettingsTitle>}
            value={(settings.danmakuModeFilter & bit) !== bit}
            disabled={!settings.enabled}
            onValueChange={(visible) => updateFilter('danmakuModeFilter', bit, visible)}
          />
        ))}
      </NativeSettingsSection>

      <NativeSettingsSection>
        <NativeSettingsItem
          title={<SettingsActionTitle>{tr('danmaku.restoreDefaults')}</SettingsActionTitle>}
          onPress={() => setSettings(defaultSettings)}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
