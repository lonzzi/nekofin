import { GlassCard } from '@/components/ui/GlassCard';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RefObject } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export type PlayerPanelHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose: () => void;
  reduceTransparency?: boolean;
  focusRef?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
};

type HeaderButtonProps = {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  reduceTransparency: boolean;
};

function HeaderButton({
  accessibilityLabel,
  icon,
  onPress,
  reduceTransparency,
}: HeaderButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <GlassCard
        colorScheme="dark"
        fallbackBackgroundColor={reduceTransparency ? '#26282E' : 'rgba(30,32,38,0.72)'}
        glassEffectStyle="clear"
        pointerEvents="none"
        radius={22}
        style={[StyleSheet.absoluteFill, styles.buttonSurface]}
        tintColor="rgba(10,12,16,0.2)"
        useGlassEffect={!reduceTransparency}
      />
      <Ionicons name={icon} color="#fff" size={21} />
    </Pressable>
  );
}

export function PlayerPanelHeader({
  title,
  subtitle,
  onBack,
  onClose,
  reduceTransparency = false,
  focusRef,
  style,
}: PlayerPanelHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      {onBack ? (
        <HeaderButton
          accessibilityLabel="返回上一级"
          icon="chevron-back"
          onPress={onBack}
          reduceTransparency={reduceTransparency}
        />
      ) : null}

      <View
        ref={focusRef}
        accessible
        accessibilityLabel={subtitle ? `${title}，${subtitle}` : title}
        accessibilityRole="header"
        style={styles.titleBlock}
      >
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <HeaderButton
        accessibilityLabel={`关闭${title}`}
        icon="close"
        onPress={onClose}
        reduceTransparency={reduceTransparency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
    lineHeight: 16,
  },
  buttonSurface: {
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: {
    opacity: 0.58,
  },
});
