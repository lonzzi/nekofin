import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FloatingTabBarInsetContext = createContext(0);

export function FloatingTabBarInsetProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // Match the native capsule height, its 8dp bottom gap and 8dp of content clearance.
  // Keep this in scroll content, so the page itself extends behind the floating bar.
  const bottomInset =
    Platform.OS === 'android' ? insets.bottom + Math.max(64, 40 + 24 * fontScale) + 16 : 0;

  return (
    <FloatingTabBarInsetContext.Provider value={bottomInset}>
      {children}
    </FloatingTabBarInsetContext.Provider>
  );
}

export function useFloatingTabBarInset() {
  return useContext(FloatingTabBarInsetContext);
}
