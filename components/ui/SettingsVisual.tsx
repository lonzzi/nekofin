import { AvatarImage } from '@/components/AvatarImage';
import { useAppTheme } from '@/lib/design-system';
import { Text as NativeText } from '@expo/ui';
import { Image as SwiftImage } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

type ValueTone = 'accent' | 'muted' | 'danger';

export function SettingsSymbol({ name, tone = 'accent' }: { name: SFSymbol; tone?: ValueTone }) {
  const theme = useAppTheme();
  const color =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'muted'
        ? theme.colors.textSecondary
        : theme.colors.tint;

  if (Platform.OS === 'ios') {
    return (
      <SwiftImage
        systemName={name}
        size={19}
        color={color}
        modifiers={[frame({ width: 28, height: 28 })]}
      />
    );
  }

  return (
    <NativeText
      numberOfLines={1}
      textStyle={{
        color,
        fontSize: 17,
        fontWeight: '700',
        lineHeight: 20,
        textAlign: 'center',
      }}
    >
      •
    </NativeText>
  );
}

export function SettingsTitle({ children }: { children: string }) {
  const theme = useAppTheme();

  return (
    <NativeText
      numberOfLines={1}
      textStyle={{
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 22,
      }}
    >
      {children}
    </NativeText>
  );
}

export function SettingsSubtitle({
  primary,
  secondary,
  lines = 1,
}: {
  primary: string;
  secondary?: string;
  lines?: number;
}) {
  const theme = useAppTheme();

  return (
    <>
      <NativeText
        numberOfLines={lines}
        textStyle={{
          color: theme.colors.textSecondary,
          fontSize: 14,
          fontWeight: '400',
          lineHeight: 18,
        }}
      >
        {primary}
      </NativeText>
      {secondary ? (
        <NativeText
          numberOfLines={2}
          textStyle={{
            color: theme.colors.textTertiary,
            fontSize: 13,
            fontWeight: '400',
            lineHeight: 17,
          }}
        >
          {secondary}
        </NativeText>
      ) : null}
    </>
  );
}

export function SettingsValue({ label, tone = 'accent' }: { label: string; tone?: ValueTone }) {
  const theme = useAppTheme();
  const color =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'muted'
        ? theme.colors.textSecondary
        : theme.colors.tint;

  return (
    <NativeText
      numberOfLines={1}
      textStyle={{
        color,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 18,
        textAlign: 'right',
      }}
    >
      {label}
    </NativeText>
  );
}

export function SettingsAvatar({
  avatarUri,
  style,
}: {
  avatarUri?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.avatarShell,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.separator,
        },
        style,
      ]}
    >
      <AvatarImage avatarUri={avatarUri} style={styles.avatarImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarShell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 10,
  },
});
