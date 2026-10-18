import { requireNativeView } from 'expo';
import { processColor, type ViewProps } from 'react-native';

const NativeSurface = requireNativeView<
  ViewProps & {
    trailingWidth?: number;
    trailingGap?: number;
    drawer?: boolean;
    surfaceColor: ReturnType<typeof processColor>;
  }
>('NativeLayout', 'NavigationSurfaceView');

/** Shares the native phone tab bar's cropped, content-only blur material. */
export function AndroidNavigationSurface({
  color,
  ...props
}: ViewProps & { color: string; trailingWidth?: number; trailingGap?: number; drawer?: boolean }) {
  return <NativeSurface {...props} surfaceColor={processColor(color)} />;
}
