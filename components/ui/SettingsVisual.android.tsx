import { AvatarImage } from '@/components/AvatarImage';
import { useAppTheme } from '@/lib/theme';
import { Icon, Text } from '@expo/ui/jetpack-compose';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ANDROID_SETTINGS_ICONS } from './nativeSettingsIcons';
import type * as SharedVisual from './SettingsVisual';

function useToneColor(tone: 'accent' | 'muted' | 'danger') {
  const theme = useAppTheme();
  return tone === 'danger'
    ? theme.colors.danger
    : tone === 'muted'
      ? theme.colors.textSecondary
      : theme.colors.tint;
}

export function SettingsSymbol({
  name,
  tone = 'accent',
}: ComponentProps<typeof SharedVisual.SettingsSymbol>) {
  const color = useToneColor(tone);
  return <Icon source={ANDROID_SETTINGS_ICONS[name]} size={24} tint={color} />;
}

export function SettingsTitle({ children }: ComponentProps<typeof SharedVisual.SettingsTitle>) {
  const theme = useAppTheme();
  return (
    <Text color={theme.colors.text} style={{ typography: 'bodyLarge' }}>
      {children}
    </Text>
  );
}

export function SettingsActionTitle({
  children,
  tone = 'danger',
}: ComponentProps<typeof SharedVisual.SettingsActionTitle>) {
  const color = useToneColor(tone);
  return (
    <Text color={color} style={{ typography: 'bodyLarge' }}>
      {children}
    </Text>
  );
}

export function SettingsSubtitle({
  primary,
  secondary,
  lines = 1,
}: ComponentProps<typeof SharedVisual.SettingsSubtitle>) {
  const theme = useAppTheme();
  return (
    <>
      <Text
        color={theme.colors.textSecondary}
        maxLines={lines}
        style={{ typography: 'bodyMedium' }}
      >
        {primary}
      </Text>
      {secondary ? (
        <Text color={theme.colors.textTertiary} maxLines={2} style={{ typography: 'bodyMedium' }}>
          {secondary}
        </Text>
      ) : null}
    </>
  );
}

export function SettingsValue({
  label,
  tone = 'accent',
}: ComponentProps<typeof SharedVisual.SettingsValue>) {
  const color = useToneColor(tone);
  return (
    <Text color={color} style={{ typography: 'labelLarge' }}>
      {label}
    </Text>
  );
}

export function SettingsAvatar({
  avatarUri,
  style,
}: ComponentProps<typeof SharedVisual.SettingsAvatar>) {
  const theme = useAppTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceMuted }, style]}>
      <AvatarImage avatarUri={avatarUri} style={styles.avatar} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
