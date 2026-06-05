import { useAppTheme } from '@/lib/design-system';
import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

type SurfaceVariant = 'default' | 'grouped' | 'elevated' | 'muted' | 'clear';

type SurfaceProps = PropsWithChildren<
  {
    variant?: SurfaceVariant;
    padded?: boolean;
    style?: StyleProp<ViewStyle>;
  } & ViewProps
>;

export function Surface({
  children,
  padded = false,
  style,
  variant = 'default',
  ...props
}: SurfaceProps) {
  const theme = useAppTheme();

  const backgroundColor = {
    clear: 'transparent',
    default: theme.colors.surface,
    elevated: theme.colors.surfaceElevated,
    grouped: theme.colors.backgroundGrouped,
    muted: theme.colors.surfaceMuted,
  }[variant];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor: theme.colors.separator,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.lg : undefined,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: 'continuous',
  },
});
