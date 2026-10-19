import { useAppTheme } from '@/lib/theme';
import { Children, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { settingsLayout } from './settingsLayout';

/** Grouped surface for React Native form content. Compose forms use NativeSettingsSection. */
export function SettingsGroup({ children, footer }: { children: ReactNode; footer?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.surface },
          Platform.OS === 'android' && [
            styles.androidSection,
            { backgroundColor: theme.colors.backgroundGrouped },
          ],
        ]}
      >
        {Platform.OS === 'android'
          ? Children.map(children, (child) =>
              child ? (
                <View style={[styles.androidRow, { backgroundColor: theme.colors.surface }]}>
                  {child}
                </View>
              ) : null,
            )
          : children}
      </View>
      {footer ? (
        <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  section: { borderRadius: 14, padding: 16, gap: 16 },
  androidSection: {
    borderRadius: settingsLayout.groupRadius,
    padding: 0,
    gap: settingsLayout.rowGap,
    overflow: 'hidden',
  },
  androidRow: { borderRadius: settingsLayout.rowRadius, overflow: 'hidden' },
  footer: { fontSize: 13, lineHeight: 19, paddingHorizontal: 12 },
});
