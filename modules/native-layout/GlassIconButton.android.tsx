import { requireNativeView } from 'expo';
import type { ComponentType, PropsWithChildren } from 'react';

/** Native Compose interaction over the shared, content-only Android material. */
export const GlassIconButton: ComponentType<
  PropsWithChildren<{
    color: string;
    enabled?: boolean;
    onButtonPressed?: () => void;
  }>
> = requireNativeView('NativeLayout', 'GlassIconButtonView');
