import { TabletChromeContext } from '@/components/navigation/TabletChromeContext';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useContext, useEffect, useId, useRef } from 'react';

/** Android's expanded native search field owns the entire tablet toolbar. */
export function useNativeSearchHeader() {
  const setActive = useContext(TabletChromeContext)?.setHeaderSearchActive;
  const owner = useId();
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const expanded = useRef(false);
  const onOpen = useCallback(() => {
    expanded.current = true;
    if (focusedRef.current) setActive?.(owner, true);
  }, [owner, setActive]);
  const onClose = useCallback(() => {
    expanded.current = false;
    setActive?.(owner, false);
  }, [owner, setActive]);

  useEffect(() => {
    setActive?.(owner, focused && expanded.current);
    return () => setActive?.(owner, false);
  }, [setActive, owner, focused]);

  // Blur can just dismiss the keyboard while the full-width search field stays
  // expanded. Restore floating tabs only on close, blur of the screen, or unmount.
  return { onOpen, onClose };
}
