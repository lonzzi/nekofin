import { useSettingsColors } from '@/hooks/useSettingsColors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '../ThemedText';

const emptyFilterValue = '__all__';

export const FilterButton = ({
  label,
  title,
  options,
  onSelect,
}: {
  label: string;
  title?: string;
  options: { label: string; value?: string; active?: boolean }[];
  onSelect: (value?: string) => void;
}) => {
  const { secondaryTextColor } = useSettingsColors();
  const useLiquidGlass = isLiquidGlassAvailable();
  const menuActions = useMemo<MenuAction[]>(
    () =>
      options.map((option) => ({
        id: option.value ?? emptyFilterValue,
        title: option.label,
        state: option.active ? 'on' : 'off',
      })),
    [options],
  );

  return (
    <MenuView
      title={title ?? label}
      actions={menuActions}
      style={styles.menuAnchor}
      onPressAction={({ nativeEvent }) => {
        onSelect(nativeEvent.event === emptyFilterValue ? undefined : nativeEvent.event);
      }}
    >
      <GlassView
        style={[
          styles.chip,
          !useLiquidGlass && {
            backgroundColor: 'rgba(127,127,127,0.14)',
          },
        ]}
        glassEffectStyle="regular"
        isInteractive
        tintColor="rgba(255,255,255,0.12)"
      >
        <View pointerEvents="none" style={styles.glassRim} />
        <Pressable style={styles.pressable}>
          <View style={styles.content}>
            <ThemedText style={styles.chipText} type="subtitle">
              {label}
            </ThemedText>
            <Ionicons name="chevron-down" size={12} color={secondaryTextColor} />
          </View>
        </Pressable>
      </GlassView>
    </MenuView>
  );
};

const styles = StyleSheet.create({
  menuAnchor: {
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  chip: {
    borderRadius: 999,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pressable: {
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontSize: 12,
  },
  glassRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
