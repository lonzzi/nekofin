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

  return (
    <RefreshControl
      {...props}
      progressViewOffset={
        progressViewOffset ?? (Platform.OS === 'android' && underStatusBar ? insets.top : undefined)
      }
    />
  );
}
