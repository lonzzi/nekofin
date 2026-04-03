import { useSettingsColors } from '@/hooks/useSettingsColors';
import { Slider as AndroidSlider } from '@expo/ui/jetpack-compose';
import { Host, Slider as IOSSlider } from '@expo/ui/swift-ui';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from './SettingsRow';

export interface SliderSettingProps {
  title: string;
  value: number;
  min: number;
  max: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  formatValue?: (value: number) => string;
  subtitle?: string;
  step?: number;
}

export const SliderSetting: React.FC<SliderSettingProps> = ({
  title,
  value,
  min,
  max,
  onValueChange,
  onSlidingComplete,
  formatValue,
  subtitle,
  step = 0.01,
}) => {
  const { accentColor } = useSettingsColors();

  const clampAndStep = useMemo(() => {
    return (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      const stepped = Math.round((clamped - min) / step) * step + min;
      return Math.max(min, Math.min(max, Number(stepped.toFixed(6))));
    };
  }, [min, max, step]);

  return (
    <View style={styles.container}>
      <SettingsRow
        title={title}
        subtitle={subtitle}
        showArrow={false}
        rightComponent={
          <Text style={[styles.valueText, { color: accentColor }]}>
            {formatValue ? formatValue(value) : value.toString()}
          </Text>
        }
        containerStyle={styles.rowContainer}
      />
      <View style={styles.sliderWrapper}>
        {Platform.OS === 'ios' ? (
          <Host style={{ minHeight: 40 }}>
            <IOSSlider
              value={value}
              onValueChange={(next) => {
                const v = clampAndStep(next);
                onValueChange?.(v);
                onSlidingComplete?.(v);
              }}
            />
          </Host>
        ) : (
          <View style={{ minHeight: 40, justifyContent: 'center' }}>
            <AndroidSlider
              value={value}
              onValueChange={(next) => {
                const v = clampAndStep(next);
                onValueChange?.(v);
                onSlidingComplete?.(v);
              }}
              colors={{ activeTrackColor: accentColor, thumbColor: accentColor }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sliderWrapper: {
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 20,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
});

export default SliderSetting;
