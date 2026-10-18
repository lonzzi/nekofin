import { TABLET_MIN_WIDTH } from '@/lib/adaptiveLayout';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

const ContentDimensionsContext = createContext<Partial<{ width: number; height: number }> | null>(
  null,
);

/** Measure the content pane rather than including a sibling navigation rail. */
export function ContentDimensionsProvider({
  children,
  width,
}: PropsWithChildren<{ width?: number }>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      const nextWidth = width ?? layout.width;
      setSize((previous) =>
        previous?.width === nextWidth && previous?.height === layout.height
          ? previous
          : { width: nextWidth, height: layout.height },
      );
    },
    [width],
  );
  // A parent-owned viewport width stays independent of floating navigation.
  // iOS split views still use their measured native content pane.
  const contentWidth = width ?? size?.width;
  const contentHeight = size?.height;
  const value = useMemo(
    () => ({
      ...(contentWidth == null ? {} : { width: contentWidth }),
      ...(contentHeight == null ? {} : { height: contentHeight }),
    }),
    [contentWidth, contentHeight],
  );
  return (
    <View style={{ flex: 1, minWidth: 0 }} onLayout={onLayout}>
      <ContentDimensionsContext value={value}>{children}</ContentDimensionsContext>
    </View>
  );
}

export function useContentDimensions() {
  const window = useWindowDimensions();
  const content = useContext(ContentDimensionsContext);
  return { ...window, ...(content ?? {}) };
}

export function useLargeContentLayout() {
  const { width } = useContentDimensions();
  return (Platform.OS === 'ios' && Platform.isPad) || width >= TABLET_MIN_WIDTH;
}
