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
      onPressAction={({ nativeEvent }) => {
        onSelect(nativeEvent.event === emptyFilterValue ? undefined : nativeEvent.event);
      }}
    >
      <GlassView
        style={[
          styles.chip,
          !isLiquidGlassAvailable() && {
            backgroundColor: 'rgba(127,127,127,0.15)',
          },
        ]}
        isInteractive
      >
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
  chip: {
    borderRadius: 999,
  },
  pressable: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontSize: 12,
  },
});
