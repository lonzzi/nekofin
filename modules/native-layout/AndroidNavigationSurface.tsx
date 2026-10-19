import { requireNativeView } from 'expo';
import { processColor, type ViewProps } from 'react-native';

const NativeSurface = requireNativeView<
  ViewProps & {
    sampleContent?: boolean;
    cornerRadius?: number;
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
}: ViewProps & {
  color: string;
  sampleContent?: boolean;
  cornerRadius?: number;
  trailingWidth?: number;
  trailingGap?: number;
  drawer?: boolean;
}) {
  return <NativeSurface {...props} surfaceColor={processColor(color)} />;
}
