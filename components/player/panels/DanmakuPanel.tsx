import { defaultSettings, useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';

import { usePlayer } from '../PlayerContext';

type DanmakuPanelProps = {
  onSearch: () => void;
};

const sliderTheme = {
  minimumTrackTintColor: '#64D2FF',
  maximumTrackTintColor: 'rgba(255,255,255,0.18)',
};

const sourceFilters = [
  { bit: 1, label: 'B站' },
  { bit: 2, label: '巴哈' },
  { bit: 4, label: '弹弹Play' },
  { bit: 8, label: '其他' },
];

const modeFilters = [
  { bit: 4, label: '滚动' },
  { bit: 2, label: '顶部' },
  { bit: 1, label: '底部' },
];

export function DanmakuPanel({ onSearch }: DanmakuPanelProps) {
  const { danmakuComments, danmakuEpisodeInfo } = usePlayer();
  const { settings, setSettings } = useDanmakuSettings();

  const updateSetting = useCallback(
    <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
      setSettings({ ...settings, [key]: value });
    },
    [setSettings, settings],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={[styles.heroIcon, settings.enabled && styles.heroIconEnabled]}>
          <Ionicons
            name={settings.enabled ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
            color="#fff"
            size={21}
          />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>显示弹幕</Text>
          <Text style={styles.heroSubtitle} numberOfLines={2}>
            {danmakuEpisodeInfo
              ? `${danmakuEpisodeInfo.animeTitle} · ${danmakuEpisodeInfo.episodeTitle}`
              : danmakuComments.length > 0
                ? `已加载 ${danmakuComments.length} 条弹幕`
                : '当前视频尚未匹配弹幕'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="显示弹幕"
          onValueChange={(enabled) => updateSetting('enabled', enabled)}
          trackColor={{ false: '#454752', true: '#0A84FF' }}
          value={settings.enabled}
        />
      </View>

      <Section title="显示效果" disabled={!settings.enabled}>
        <SettingSlider
          disabled={!settings.enabled}
          format={(value) => `${Math.round(value * 100)}%`}
          label="透明度"
          max={1}
          min={0.1}
          onChange={(value) => updateSetting('opacity', value)}
          step={0.05}
          value={settings.opacity}
        />
        <SettingSlider
          disabled={!settings.enabled}
          format={(value) => `${Math.round(value)} px`}
          label="字体大小"
          max={36}
          min={12}
          onChange={(value) => updateSetting('fontSize', Math.round(value))}
          step={1}
          value={settings.fontSize}
        />
        <SettingSlider
          disabled={!settings.enabled}
          format={(value) => `${Math.round(value * 100)}%`}
          label="显示区域"
          max={1}
          min={0.3}
          onChange={(value) => updateSetting('heightRatio', value)}
          step={0.05}
          value={settings.heightRatio}
        />
      </Section>

      <Section title="弹幕来源" disabled={!settings.enabled}>
        <View style={styles.chipRow}>
          {sourceFilters.map(({ bit, label }) => {
            const selected = (settings.danmakuFilter & bit) !== bit;
            return (
              <FilterChip
                key={bit}
                disabled={!settings.enabled}
                label={label}
                onPress={() => updateSetting('danmakuFilter', settings.danmakuFilter ^ bit)}
                selected={selected}
              />
            );
          })}
        </View>
      </Section>

      <Section title="弹幕类型" disabled={!settings.enabled}>
        <View style={styles.chipRow}>
          {modeFilters.map(({ bit, label }) => {
            const selected = (settings.danmakuModeFilter & bit) !== bit;
            return (
              <FilterChip
                key={bit}
                disabled={!settings.enabled}
                label={label}
                onPress={() => updateSetting('danmakuModeFilter', settings.danmakuModeFilter ^ bit)}
                selected={selected}
              />
            );
          })}
        </View>
      </Section>

      <View style={styles.actionCard}>
        <Pressable
          accessibilityLabel="搜索并重新匹配弹幕"
          accessibilityRole="button"
          onPress={onSearch}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Ionicons name="search" color="#64D2FF" size={19} />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>搜索弹幕</Text>
            <Text style={styles.actionSubtitle}>手动选择番剧与剧集，替换当前弹幕</Text>
          </View>
          <Ionicons name="chevron-forward" color="rgba(255,255,255,0.45)" size={18} />
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable
          accessibilityLabel="恢复弹幕默认设置"
          accessibilityRole="button"
          onPress={() => setSettings(defaultSettings)}
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
        >
          <Text style={styles.resetText}>恢复默认设置</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({
  children,
  disabled,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title: string;
}) {
  return (
    <View style={disabled && styles.sectionDisabled}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingSlider({
  disabled,
  format,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  disabled?: boolean;
  format: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  const progress = useSharedValue(value);
  const minimumValue = useSharedValue(min);
  const maximumValue = useSharedValue(max);

  useEffect(() => {
    progress.value = value;
  }, [progress, value]);

  const steps = Math.round((max - min) / step);
  const adjustValue = (direction: -1 | 1) => {
    const nextValue = Math.min(max, Math.max(min, value + step * direction));
    onChange(nextValue);
  };

  return (
    <View
      accessibilityActions={[{ name: 'decrement' }, { name: 'increment' }]}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled }}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessible
      onAccessibilityAction={({ nativeEvent }) => {
        if (disabled) return;
        if (nativeEvent.actionName === 'increment') adjustValue(1);
        if (nativeEvent.actionName === 'decrement') adjustValue(-1);
      }}
      style={styles.sliderRow}
    >
      <View style={styles.settingHeader}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{format(value)}</Text>
      </View>
      <Slider
        disable={disabled}
        disableTapEvent={false}
        maximumValue={maximumValue}
        minimumValue={minimumValue}
        onSlidingComplete={(nextValue) => {
          const rounded = Math.round(nextValue / step) * step;
          onChange(Math.min(max, Math.max(min, rounded)));
        }}
        progress={progress}
        sliderHeight={3}
        steps={steps}
        style={styles.settingSlider}
        theme={sliderTheme}
        thumbTouchSize={28}
        thumbWidth={14}
      />
    </View>
  );
}

function FilterChip({
  disabled,
  label,
  onPress,
  selected,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      {selected && <Ionicons name="checkmark" color="#fff" size={14} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroIconEnabled: {
    backgroundColor: '#0A84FF',
  },
  heroText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 15,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 7,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionDisabled: {
    opacity: 0.42,
  },
  sliderRow: {
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  settingValue: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  settingSlider: {
    height: 28,
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: 'rgba(10,132,255,0.8)',
    borderColor: 'rgba(100,210,255,0.58)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  actionCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSubtitle: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
  },
  actionDivider: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
  },
  resetButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  resetText: {
    color: '#FF6961',
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.56,
  },
});
