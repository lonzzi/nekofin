import { useAppTheme } from '@/lib/theme';
import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor = '#fff',
  darkColor = '#000',
  ...otherProps
}: ThemedViewProps) {
  const theme = useAppTheme();
  const backgroundColor =
    theme.colorScheme === 'dark'
      ? (darkColor ?? theme.colors.background)
      : (lightColor ?? theme.colors.background);

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
