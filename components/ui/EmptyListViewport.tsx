import { requireNativeView } from 'expo';
import type { ComponentType, PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

type EmptyListViewportProps = PropsWithChildren<{ bottomSpacing: number }>;

const NativeViewport: ComponentType<ViewProps & EmptyListViewportProps> | null =
  Platform.OS === 'ios' ? requireNativeView('ScrollViewport') : null;

export const emptyListContentStyle = { flexGrow: Platform.OS === 'ios' ? 0 : 1 };

export function EmptyListViewport({ children, bottomSpacing }: EmptyListViewportProps) {
  if (NativeViewport) {
    return (
      <NativeViewport style={styles.native} bottomSpacing={bottomSpacing}>
        {children}
      </NativeViewport>
    );
  }
  return <View style={styles.fallback}>{children}</View>;
}

const styles = StyleSheet.create({
  native: { alignSelf: 'stretch', minHeight: 160, justifyContent: 'center' },
  fallback: { flex: 1, minHeight: 160, justifyContent: 'center' },
});
