import { useAppTheme } from '@/lib/theme';
import { GlassIconButton } from '@/modules/native-layout/GlassIconButton.android';
import type { PropsWithChildren } from 'react';

/** One centered glass control shared by back, toolbar actions, avatars and progress. */
export function HeaderIconButton({
  children,
  onClick,
  enabled = true,
}: PropsWithChildren<{ onClick?: () => void; enabled?: boolean }>) {
  const theme = useAppTheme();
  return (
    <GlassIconButton color={theme.colors.background} enabled={enabled} onButtonPressed={onClick}>
      {children}
    </GlassIconButton>
  );
}
