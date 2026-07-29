import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { PlayerPanelHeader } from './PlayerPanelHeader';

export type PlayerPanelHostProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onDismiss: () => void;
  onBack?: () => void;
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

type PanelPresentation = Pick<
  PlayerPanelHostProps,
  'bodyStyle' | 'children' | 'onBack' | 'subtitle' | 'title'
>;

const supportedOrientations = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
] as const;

export function PlayerPanelHost({
  visible,
  title,
  subtitle,
  children,
  onDismiss,
  onBack,
  bodyStyle,
  testID = 'player-panel-host',
}: PlayerPanelHostProps) {
  const focusRef = useRef<View>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPresentationRef = useRef<PanelPresentation>({
    bodyStyle,
    children,
    onBack,
    subtitle,
    title,
  });
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      lastPresentationRef.current = { bodyStyle, children, onBack, subtitle, title };
    }
  }, [bodyStyle, children, onBack, subtitle, title, visible]);

  const focusTitle = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      const reactTag = findNodeHandle(focusRef.current);
      if (reactTag != null) AccessibilityInfo.setAccessibilityFocus(reactTag);
    }, 120);
  }, []);

  useEffect(() => {
    if (visible) focusTitle();
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [focusTitle, title, visible]);

  const presentation = visible
    ? { bodyStyle, children, onBack, subtitle, title }
    : lastPresentationRef.current;
  const requestClose = Platform.OS === 'ios' ? onDismiss : (presentation.onBack ?? onDismiss);

  return (
    <Modal
      allowSwipeDismissal={Platform.OS === 'ios'}
      animationType="slide"
      backdropColor="#111318"
      hardwareAccelerated
      onRequestClose={requestClose}
      onShow={focusTitle}
      presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'}
      supportedOrientations={[...supportedOrientations]}
      visible={visible}
    >
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.sheet}>
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={presentation.onBack ?? onDismiss}
            style={styles.content}
            testID={testID}
          >
            <PlayerPanelHeader
              focusRef={focusRef}
              onBack={presentation.onBack}
              onClose={onDismiss}
              reduceTransparency={reduceTransparency}
              subtitle={presentation.subtitle}
              title={presentation.title}
            />
            <View style={[styles.body, presentation.bodyStyle]}>{presentation.children}</View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#111318',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
