/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { ColorValue } from 'react-native';

export function useThemeColor(
  props: { light?: string | ColorValue; dark?: string | ColorValue },
  colorName?: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { accentColor } = useAccentColor();
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else if (colorName === 'tint' || colorName === 'tabIconSelected') {
    return accentColor;
  } else if (colorName) {
    return Colors[theme][colorName];
  } else {
    return undefined;
  }
}
