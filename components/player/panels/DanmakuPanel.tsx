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
import { useCallback } from 'react';

import { usePlayer } from '../PlayerContext';

type DanmakuPanelProps = {
  onSearch: () => void;
};

const densityProfiles = [
  { title: '自动', value: '0' },
  { title: '宽松', value: '1' },
  { title: '标准', value: '2' },
  { title: '严格', value: '3' },
  { title: '极简', value: '4' },
];

const sourceFilters = [
  { bit: 1, label: '显示 B 站弹幕' },
  { bit: 2, label: '显示巴哈弹幕' },
  { bit: 4, label: '显示弹弹 Play 弹幕' },
  { bit: 8, label: '显示其他来源' },
];

const modeFilters = [
  { bit: 4, label: '显示滚动弹幕' },
  { bit: 2, label: '显示顶部弹幕' },
  { bit: 1, label: '显示底部弹幕' },
];

export function DanmakuPanel({ onSearch }: DanmakuPanelProps) {
  const { danmakuComments, danmakuEpisodeInfo } = usePlayer();
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
      ? `已加载 ${danmakuComments.length} 条弹幕`
      : '当前视频尚未匹配弹幕';

  return (
    <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-settings">
      <NativeSettingsSection title="当前弹幕">
        <NativeSettingsSwitch
          leading={<SettingsSymbol name="text.bubble" />}
          title={<SettingsTitle>显示弹幕</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={matchDescription} lines={2} />}
          value={settings.enabled}
          onValueChange={(enabled) => updateSetting('enabled', enabled)}
        />
        <NativeSettingsItem
          leading={<SettingsSymbol name="magnifyingglass" />}
          title={<SettingsTitle>搜索弹幕</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="使用系统搜索表单重新匹配番剧与剧集" />}
          disclosure
          onPress={onSearch}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="显示效果">
        <NativeSettingsSlider
          title={<SettingsTitle>透明度</SettingsTitle>}
          value={settings.opacity}
          min={0.1}
          max={1}
          step={0.05}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('opacity', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>字体大小</SettingsTitle>}
          value={settings.fontSize}
          min={12}
          max={36}
          step={1}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('fontSize', Math.round(value))}
          formatValue={(value) => `${Math.round(value)} px`}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>显示区域</SettingsTitle>}
          value={settings.heightRatio}
          min={0.3}
          max={1}
          step={0.05}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('heightRatio', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="运动与密度">
        <NativeSettingsSlider
          title={<SettingsTitle>滚动速度</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="长弹幕会在此基础上自动提速" />}
          value={Math.max(80, Math.min(240, settings.speed))}
          min={80}
          max={240}
          step={10}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('speed', Math.round(value))}
          formatValue={(value) => `${Math.round(value)} px/s`}
        />
        <NativeSettingsPicker
          title={<SettingsTitle>屏幕密度</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="限制轨道拥挤度与同屏弹幕数量" />}
          value={String(settings.danmakuDensityLimit)}
          options={densityProfiles}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('danmakuDensityLimit', Number(value))}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>防止重叠</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="预测追尾并避开固定弹幕" />}
          value={settings.collisionPolicy === 'avoid'}
          disabled={!settings.enabled}
          onValueChange={(enabled) => updateSetting('collisionPolicy', enabled ? 'avoid' : 'allow')}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>时间校准</SettingsTitle>}
          value={Math.max(-5, Math.min(5, settings.curEpOffset))}
          min={-5}
          max={5}
          step={0.5}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('curEpOffset', value)}
          formatValue={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}s`}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="弹幕来源">
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

      <NativeSettingsSection title="弹幕类型">
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
          title={<SettingsActionTitle>恢复默认设置</SettingsActionTitle>}
          onPress={() => setSettings(defaultSettings)}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
