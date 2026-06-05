import PageScrollView from '@/components/PageScrollView';
import { Section } from '@/components/ui/Section';
import { SliderSetting } from '@/components/ui/SliderSetting';
import { SwitchSetting } from '@/components/ui/SwitchSetting';
import { defaultSettings, useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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
    const newFilter = settings.danmakuFilter ^ bit;
    updateSetting('danmakuFilter', newFilter);
  };

  const toggleModeFilter = (bit: number) => {
    const newFilter = settings.danmakuModeFilter ^ bit;
    updateSetting('danmakuModeFilter', newFilter);
  };

  const handleResetToDefault = () => {
    setSettings(defaultSettings);
    Alert.alert('恢复默认设置', '所有设置已恢复为默认值');
  };

  return (
    <PageScrollView showsVerticalScrollIndicator={false}>
      <Section title="基础设置">
        <SliderSetting
          title="透明度"
          subtitle="弹幕显示的透明度"
          value={settings.opacity}
          min={0.1}
          max={1.0}
          step={0.05}
          onSlidingComplete={(value) => updateSetting('opacity', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
        <SliderSetting
          title="字体大小"
          subtitle="弹幕文字的大小"
          value={mapFontSizeToSlider(settings.fontSize)}
          min={0}
          max={1}
          step={1 / FONT_SIZE_RANGE}
          onSlidingComplete={(value) => updateSetting('fontSize', mapSliderToFontSize(value))}
          formatValue={(value) => `${mapSliderToFontSize(value)}px`}
        />
        <SliderSetting
          title="显示区域"
          subtitle="弹幕在屏幕上的显示范围"
          value={settings.heightRatio}
          min={0.3}
          max={1.0}
          step={0.05}
          onSlidingComplete={(value) => updateSetting('heightRatio', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
      </Section>

      <Section title="弹幕来源过滤">
        <SwitchSetting
          title="B站弹幕"
          value={(settings.danmakuFilter & 1) !== 1}
          onValueChange={() => toggleFilter(1)}
        />
        <SwitchSetting
          title="巴哈弹幕"
          value={(settings.danmakuFilter & 2) !== 2}
          onValueChange={() => toggleFilter(2)}
        />
        <SwitchSetting
          title="弹弹Play弹幕"
          value={(settings.danmakuFilter & 4) !== 4}
          onValueChange={() => toggleFilter(4)}
        />
        <SwitchSetting
          title="其他来源弹幕"
          value={(settings.danmakuFilter & 8) !== 8}
          onValueChange={() => toggleFilter(8)}
        />
      </Section>

      <Section title="弹幕类型过滤">
        <SwitchSetting
          title="底部弹幕"
          value={(settings.danmakuModeFilter & 1) !== 1}
          onValueChange={() => toggleModeFilter(1)}
        />
        <SwitchSetting
          title="顶部弹幕"
          value={(settings.danmakuModeFilter & 2) !== 2}
          onValueChange={() => toggleModeFilter(2)}
        />
        <SwitchSetting
          title="滚动弹幕"
          value={(settings.danmakuModeFilter & 4) !== 4}
          onValueChange={() => toggleModeFilter(4)}
        />
      </Section>

      <View style={styles.bottomSpacing} />

      <View style={styles.resetSection}>
        <Pressable
          style={[styles.resetButton, { backgroundColor: '#FF6B6B' }]}
          onPress={handleResetToDefault}
        >
          <Text style={styles.resetButtonText}>恢复默认设置</Text>
        </Pressable>
      </View>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  bottomSpacing: {
    height: 60,
  },
  resetSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
