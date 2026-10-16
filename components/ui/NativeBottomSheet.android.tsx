import { useAppTheme } from '@/lib/theme';
import { Host, ModalBottomSheet, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { testID as nativeTestID } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';

/** Compose owns the window, dragging, scrolling and dismissal animation. */
export function NativeBottomSheet({
  children,
  isPresented,
  onDismiss,
  skipPartiallyExpanded = false,
  containerColor,
  testID,
}: {
  children: ReactNode;
  isPresented: boolean;
  onDismiss: () => void;
  skipPartiallyExpanded?: boolean;
  containerColor?: ColorValue;
  testID?: string;
}) {
  const theme = useAppTheme();
  const sheet = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(isPresented);
  useEffect(() => {
    if (isPresented) {
      setMounted(true);
      return;
    }
    let cancelled = false;
    void sheet.current?.hide().then(() => {
      if (!cancelled) setMounted(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isPresented]);

  if (!mounted) return null;
  return (
    <Host style={{ position: 'absolute' }} pointerEvents="none" colorScheme={theme.colorScheme}>
      <ModalBottomSheet
        ref={sheet}
        onDismissRequest={onDismiss}
        skipPartiallyExpanded={skipPartiallyExpanded}
        containerColor={containerColor ?? theme.colors.background}
        contentColor={theme.colors.text}
        modifiers={testID ? [nativeTestID(testID)] : undefined}
      >
        {children}
      </ModalBottomSheet>
    </Host>
  );
}
