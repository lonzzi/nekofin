import { useIsTablet } from '@/hooks/useIsTablet';
import { resolvePlayerEntryVisibility } from '@/lib/playerEntry';
import { useCallback, useEffect, useState } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';

export function usePlayerEntryVisibility(preference?: string, hasAppeared = true) {
  const tablet = useIsTablet();
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const onLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setLayout((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  }, []);

  useEffect(() => {
    if (
      visible ||
      !hasAppeared ||
      !resolvePlayerEntryVisibility(false, {
        ...layout,
        preference,
        flexibleWindow: Platform.OS === 'web' || tablet,
      })
    )
      return;
    // Wait for native presentation as well as the target viewport, so control
    // animations don't finish behind the incoming screen. Expo's orientation
    // can remain UNKNOWN after rotation; the measured viewport is authoritative.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [layout, preference, visible, hasAppeared, tablet]);

  return { visible, onLayout };
}
