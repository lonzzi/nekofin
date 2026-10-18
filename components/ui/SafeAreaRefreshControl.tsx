import { useHeaderHeight } from 'expo-router/react-navigation';
import { Platform, RefreshControl, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeAreaRefreshControlProps = RefreshControlProps & {
  /** The scroll view extends behind the status bar instead of starting below a native header. */
  underStatusBar?: boolean;
};

export function SafeAreaRefreshControl({
  underStatusBar = false,
  progressViewOffset,
  ...props
}: SafeAreaRefreshControlProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  // Edge-to-edge pages also sit beneath the native toolbar and floating tablet tabs.
  const topOffset = Math.max(insets.top, headerHeight);

  return (
    <RefreshControl
      {...props}
      progressViewOffset={
        progressViewOffset ?? (Platform.OS === 'android' && underStatusBar ? topOffset : undefined)
      }
    />
  );
}
