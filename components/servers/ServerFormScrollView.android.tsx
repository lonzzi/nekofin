import PageScrollView from '@/components/PageScrollView';
import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

export function ServerFormScrollView(props: ComponentProps<typeof PageScrollView>) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <PageScrollView {...props} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
