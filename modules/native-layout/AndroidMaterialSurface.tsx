import { requireNativeView } from 'expo';
import type { ComponentType, PropsWithChildren } from 'react';
import type { ColorValue } from 'react-native';

/** Compose content over the same safe material used by Android player controls. */
export const AndroidMaterialSurface: ComponentType<
  PropsWithChildren<{
    color: ColorValue;
    cornerRadius?: number;
    sheetDragHandle?: boolean;
  }>
> = requireNativeView('NativeLayout', 'MaterialSurfaceView');
