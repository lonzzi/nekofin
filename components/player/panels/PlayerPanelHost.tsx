import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

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

const LANDSCAPE_MIN_WIDTH = 360;
const LANDSCAPE_MAX_WIDTH = 520;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

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
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const panelWidth = clamp(width * 0.42, LANDSCAPE_MIN_WIDTH, LANDSCAPE_MAX_WIDTH);
  const availablePortraitHeight = Math.max(height - Math.max(insets.top, 16) - 12, 320);
  const panelHeight = Math.min(Math.max(height * 0.74, 360), availablePortraitHeight);
  const progress = useSharedValue(0);
  const focusRef = useRef<View>(null);
  const closingRef = useRef(false);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    const transparencySubscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => {
      motionSubscription.remove();
      transparencySubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
    } else {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      progress.value = 0;
    }
  }, [progress, visible]);

  useEffect(
    () => () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    },
    [],
  );

  const finishDismiss = useCallback(() => {
    closingRef.current = false;
    onDismiss();
  }, [onDismiss]);

  const requestDismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }

    if (reduceMotion) {
      progress.value = 0;
      finishDismiss();
      return;
    }

    progress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) scheduleOnRN(finishDismiss);
    });
  }, [finishDismiss, progress, reduceMotion]);

  const handleShow = useCallback(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : 260 });

    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(
      () => {
        focusTimerRef.current = null;
        const reactTag = findNodeHandle(focusRef.current);
        if (reactTag != null) AccessibilityInfo.setAccessibilityFocus(reactTag);
      },
      reduceMotion ? 0 : 280,
    );
  }, [progress, reduceMotion]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.52,
  }));
  const panelAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: isLandscape
        ? [{ translateX: (1 - progress.value) * panelWidth }]
        : [{ translateY: (1 - progress.value) * panelHeight }],
    }),
    [isLandscape, panelHeight, panelWidth],
  );

  const panelGeometryStyle: ViewStyle = isLandscape
    ? {
        bottom: 0,
        right: 0,
        top: 0,
        width: panelWidth,
      }
    : {
        bottom: 0,
        height: panelHeight,
        left: 0,
        right: 0,
      };
  const headerInsetStyle: ViewStyle | undefined = isLandscape
    ? {
        paddingRight: Math.max(insets.right + 12, 16),
        paddingTop: Math.max(insets.top + 8, 12),
      }
    : undefined;
  const bodyInsetStyle: ViewStyle = {
    paddingBottom: Math.max(insets.bottom, 12),
    paddingRight: isLandscape ? insets.right : 0,
  };

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onBack ?? requestDismiss}
      onShow={handleShow}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={onBack ?? requestDismiss}
        style={styles.modalRoot}
        testID={testID}
      >
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropAnimatedStyle]} />
        <Pressable accessible={false} onPress={requestDismiss} style={StyleSheet.absoluteFill} />

        <Animated.View
          style={[
            styles.panel,
            isLandscape ? styles.landscapePanel : styles.portraitPanel,
            panelGeometryStyle,
            panelAnimatedStyle,
          ]}
        >
          {reduceTransparency ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.opaqueSurface]} />
          ) : (
            <BlurView
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={88}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          )}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.surfaceTint]} />

          <PlayerPanelHeader
            focusRef={focusRef}
            onBack={onBack}
            onClose={requestDismiss}
            reduceTransparency={reduceTransparency}
            style={headerInsetStyle}
            subtitle={subtitle}
            title={title}
          />
          <View style={[styles.body, bodyInsetStyle, bodyStyle]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#000',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  panel: {
    borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: '-16px 0 48px rgba(0,0,0,0.34)',
    overflow: 'hidden',
    position: 'absolute',
  },
  landscapePanel: {
    borderBottomLeftRadius: 28,
    borderCurve: 'continuous',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 28,
  },
  portraitPanel: {
    borderCurve: 'continuous',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 -16px 48px rgba(0,0,0,0.34)',
  },
  opaqueSurface: {
    backgroundColor: '#111318',
  },
  surfaceTint: {
    backgroundColor: 'rgba(13,14,18,0.6)',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
