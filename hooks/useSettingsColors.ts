import { useAppTheme } from '@/lib/design-system';

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
