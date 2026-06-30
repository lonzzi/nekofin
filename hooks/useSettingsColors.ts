import { useAppTheme } from '@/lib/theme';

export function useSettingsColors() {
  const theme = useAppTheme();

  return {
    textColor: theme.colors.text,
    secondaryTextColor: theme.colors.textSecondary,
    backgroundColor: theme.colors.background,
    accentColor: theme.colors.tint,
    separatorColor: theme.colors.separator,
    secondarySystemGroupedBackground: theme.colors.surface,
  };
}
