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
import { Alert } from 'react-native';

export default function DanmakuSettingsScreen() {
  const { settings, setSettings } = useDanmakuSettings();

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
    setSettings(defaultSettings);
    Alert.alert('恢复默认设置', '所有设置已恢复为默认值');
  };

  return (
    <NativeSettingsForm testID="danmaku-settings-form">
      <NativeSettingsSection title="基础设置">
        <NativeSettingsSwitch
          title={<SettingsTitle>显示弹幕</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="控制播放器中的弹幕总开关" />}
          value={settings.enabled}
          onValueChange={(value) => updateSetting('enabled', value)}
        />
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
          subtitle={<SettingsSubtitle primary="同时限制轨道拥挤度与同屏弹幕数量" />}
          value={String(settings.danmakuDensityLimit)}
          disabled={!settings.enabled}
          options={[
            { title: '自动', value: '0' },
            { title: '宽松', value: '1' },
            { title: '标准', value: '2' },
            { title: '严格', value: '3' },
            { title: '极简', value: '4' },
          ]}
          onValueChange={(value) => updateSetting('danmakuDensityLimit', Number(value))}
        />
        <NativeSettingsSwitch
          title={<SettingsTitle>防止重叠</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="预测追尾并避开其他类型占用的轨道" />}
          value={settings.collisionPolicy === 'avoid'}
          disabled={!settings.enabled}
          onValueChange={(value) => updateSetting('collisionPolicy', value ? 'avoid' : 'allow')}
        />
      </NativeSettingsSection>

      <NativeSettingsSection title="时间校准">
        <NativeSettingsSlider
          title={<SettingsTitle>弹幕偏移</SettingsTitle>}
          subtitle={<SettingsSubtitle primary="弹幕偏晚时向左调，偏早时向右调" />}
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
            title={<SettingsActionTitle tone="accent">偏移归零</SettingsActionTitle>}
            onPress={() => updateSetting('curEpOffset', 0)}
          />
        ) : null}
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
          title={<SettingsActionTitle>恢复默认设置</SettingsActionTitle>}
          onPress={handleResetToDefault}
        />
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
