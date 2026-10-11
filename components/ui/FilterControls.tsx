import { useAppTheme } from '@/lib/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FilterChoiceProps, FilterRowProps } from './filterControlTypes';

export { FilterButton } from './FilterButton';

export function FilterRow({ children, spacing = 8, style }: FilterRowProps) {
  return <View style={[styles.row, { gap: spacing }, style]}>{children}</View>;
}

export function FilterChoice({ label, active, onPress }: FilterChoiceProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: active ? theme.colors.text : theme.colors.surfaceMuted },
      ]}
    >
      <Text style={{ color: active ? theme.colors.background : theme.colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  choice: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: 'center' },
});
