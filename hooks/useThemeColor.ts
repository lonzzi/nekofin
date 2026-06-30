/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AppColorRole, useAppTheme } from '@/lib/theme';
import { ColorValue } from 'react-native';

export function useThemeColor(
  props: { light?: string | ColorValue; dark?: string | ColorValue },
  colorName?: (keyof typeof Colors.light & keyof typeof Colors.dark) | AppColorRole,
) {
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const appTheme = useAppTheme();
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else if (colorName === 'tint' || colorName === 'tabIconSelected') {
    return appTheme.colors.tint;
  } else if (colorName && colorName in appTheme.colors) {
    return appTheme.colors[colorName as AppColorRole];
  } else if (colorName) {
    return Colors[theme][colorName as keyof typeof Colors.light & keyof typeof Colors.dark];
  } else {
    return undefined;
  }
}
