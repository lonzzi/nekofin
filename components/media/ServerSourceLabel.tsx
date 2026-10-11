import { useAppTheme } from '@/lib/theme';
import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '../ui/IconSymbol';

export function ServerSourceLabel({ name }: { name: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <IconSymbol name="externaldrive" size={11} color={theme.colors.textSecondary} />
      <Text style={[styles.label, { color: theme.colors.textSecondary }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  label: { fontSize: 11, lineHeight: 15, flexShrink: 1 },
});
