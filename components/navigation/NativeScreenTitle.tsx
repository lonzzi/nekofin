import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export const nativeScreenTitleOptions = {
  headerLargeTitle: Platform.OS === 'ios',
} as const;

/** One native title policy for pages, including loading and empty list states. */
export function NativeScreenTitle({
  children,
  large = true,
}: {
  children: string;
  large?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Stack.Title
      large={large && nativeScreenTitleOptions.headerLargeTitle}
      style={{ color: theme.colors.text }}
      largeStyle={{ color: theme.colors.text }}
    >
      {children}
    </Stack.Title>
  );
}
