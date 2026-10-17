import { useAppTheme } from '@/lib/theme';
import { ActivityIndicator } from 'react-native';

export function HeaderActionProgress({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <ActivityIndicator
      accessibilityLabel={label}
      color={theme.colors.tint}
      style={{ width: 44, height: 44 }}
    />
  );
}
