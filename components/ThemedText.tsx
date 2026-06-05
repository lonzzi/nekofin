import { useAppTheme } from '@/lib/design-system';
import { StyleSheet, Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const theme = useAppTheme();
  const color =
    theme.colorScheme === 'dark'
      ? (darkColor ?? theme.colors.text)
      : (lightColor ?? theme.colors.text);
  const linkColor = theme.colors.tint;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? theme.typography.body : undefined,
        type === 'title' ? theme.typography.largeTitle : undefined,
        type === 'defaultSemiBold' ? theme.typography.bodyEmphasized : undefined,
        type === 'subtitle' ? theme.typography.title3 : undefined,
        type === 'link' ? [styles.link, { color: linkColor }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 16,
    lineHeight: 22,
  },
});
