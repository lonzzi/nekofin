import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSlider,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsTitle, SettingsValue } from '@/components/ui/SettingsVisual';
import { defaultSettings, useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { Alert } from 'react-native';

export default function DanmakuSettingsScreen() {
  const { settings, setSettings } = useDanmakuSettings();

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 36;
  const FONT_SIZE_RANGE = FONT_SIZE_MAX - FONT_SIZE_MIN;

  const mapFontSizeToSlider = (fontSize: number) => (fontSize - FONT_SIZE_MIN) / FONT_SIZE_RANGE;
  const mapSliderToFontSize = (sliderValue: number) =>
    Math.round(FONT_SIZE_MIN + sliderValue * FONT_SIZE_RANGE);

  const toggleFilter = (bit: number) => {
    updateSetting('danmakuFilter', settings.danmakuFilter ^ bit);
  };

  const toggleModeFilter = (bit: number) => {
    updateSetting('danmakuModeFilter', settings.danmakuModeFilter ^ bit);
  };

  const handleResetToDefault = () => {
    setSettings(defaultSettings);
    Alert.alert('恢复默认设置', '所有设置已恢复为默认值');
  };

  return (
    <NativeSettingsForm testID="danmaku-settings-form">
      <NativeSettingsSection title="基础设置">
        <NativeSettingsSlider
          title={<SettingsTitle>透明度</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="弹幕显示的透明度" />}
          value={settings.opacity}
          min={0.1}
          max={1.0}
          step={0.05}
          onValueChange={(value) => updateSetting('opacity', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>字体大小</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="弹幕文字的大小" />}
          value={mapFontSizeToSlider(settings.fontSize)}
          min={0}
          max={1}
          step={1 / FONT_SIZE_RANGE}
          onValueChange={(value) => updateSetting('fontSize', mapSliderToFontSize(value))}
          formatValue={(value) => `${mapSliderToFontSize(value)}px`}
        />
        <NativeSettingsSlider
          title={<SettingsTitle>显示区域</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="弹幕在屏幕上的显示范围" />}
          value={settings.heightRatio}
          min={0.3}
          max={1.0}
          step={0.05}
          onValueChange={(value) => updateSetting('heightRatio', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="弹幕来源过滤">
        <NativeSettingsSwitch
          title={<SettingsTitle>B站弹幕</SettingsTitle>}
          value={(settings.danmakuFilter & 1) !== 1}
          onValueChange={() => toggleFilter(1)}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>巴哈弹幕</SettingsTitle>}
          value={(settings.danmakuFilter & 2) !== 2}
          onValueChange={() => toggleFilter(2)}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>弹弹Play弹幕</SettingsTitle>}
          value={(settings.danmakuFilter & 4) !== 4}
          onValueChange={() => toggleFilter(4)}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>其他来源弹幕</SettingsTitle>}
          value={(settings.danmakuFilter & 8) !== 8}
          onValueChange={() => toggleFilter(8)}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="弹幕类型过滤">
        <NativeSettingsSwitch
          title={<SettingsTitle>底部弹幕</SettingsTitle>}
          value={(settings.danmakuModeFilter & 1) !== 1}
          onValueChange={() => toggleModeFilter(1)}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>顶部弹幕</SettingsTitle>}
          value={(settings.danmakuModeFilter & 2) !== 2}
          onValueChange={() => toggleModeFilter(2)}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>滚动弹幕</SettingsTitle>}
          value={(settings.danmakuModeFilter & 4) !== 4}
          onValueChange={() => toggleModeFilter(4)}
        />
      </NativeSettingsSection>

      <NativeSettingsSection>
        <NativeSettingsItem
          title={<SettingsTitle>恢复默认设置</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="将弹幕显示、来源和类型过滤恢复为默认值" />}
          trailing={<SettingsValue label="恢复" tone="danger" />}
          onPress={handleResetToDefault}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
