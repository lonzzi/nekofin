import { useAppTheme } from '@/lib/theme';
import { AndroidNavigationSurface } from '@/modules/native-layout/AndroidNavigationSurface';
import { requireNativeView } from 'expo';
import { StyleSheet, type ViewProps } from 'react-native';

const FloatingTabsGestureView = requireNativeView<ViewProps>(
  'NativeLayout',
  'FloatingTabsGestureView',
);

/** Native material, outline and clipping for every floating Android navigation control. */
export function NavigationCapsule({ children, style, ...props }: ViewProps) {
  const theme = useAppTheme();
  return (
    <FloatingTabsGestureView {...props} style={[styles.capsule, style]}>
      <AndroidNavigationSurface
        pointerEvents="none"
        color={theme.colors.background}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </FloatingTabsGestureView>
  );
}

const styles = StyleSheet.create({
  capsule: { overflow: 'hidden', borderRadius: 28 },
});
