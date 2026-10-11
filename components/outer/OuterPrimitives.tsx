import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export function OuterScreenOptions({
  title,
  large = true,
  grouped = false,
}: {
  title: string;
  large?: boolean;
  grouped?: boolean;
}) {
  const t = useAppTheme();
  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerTitle: title,
          headerLargeTitle: large,
          headerTitleStyle: { color: t.colors.text },
          headerLargeTitleStyle: { color: t.colors.text },
          headerTintColor: t.colors.tint,
          headerStyle:
            Platform.OS === 'ios'
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: t.colors.background },
          headerLargeStyle: undefined,
          contentStyle: {
            backgroundColor: grouped ? t.colors.backgroundGrouped : t.colors.background,
          },
        }}
      />
    </>
  );
}
export function EditorialHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  const t = useAppTheme();
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: t.colors.tint }]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.text }]}>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: t.colors.textSecondary }]}>{description}</Text>
      ) : null}
    </View>
  );
}
export function ActionButton({
  label,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const t = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? t.colors.surfaceMuted : t.colors.tint,
          opacity: disabled || busy ? 0.6 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? t.colors.text : t.colors.inverseText} /> : null}
      <Text
        style={[styles.buttonText, { color: secondary ? t.colors.text : t.colors.inverseText }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Paper({ children }: PropsWithChildren) {
  const t = useAppTheme();
  return (
    <View
      style={[styles.paper, { backgroundColor: t.colors.surface, borderColor: t.colors.separator }]}
    >
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { gap: 10, paddingVertical: 16 },
  eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  description: { fontSize: 15, lineHeight: 23 },
  button: {
    minHeight: 52,
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  paper: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, gap: 12 },
});

export function OuterTitle({ children, large = true }: { children: string; large?: boolean }) {
  const theme = useAppTheme();
  return (
    <Stack.Title
      large={large}
      style={{ color: theme.colors.text }}
      largeStyle={{ color: theme.colors.text }}
    >
      {children}
    </Stack.Title>
  );
}
