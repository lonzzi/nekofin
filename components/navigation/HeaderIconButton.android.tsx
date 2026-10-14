import { useAppTheme } from '@/lib/theme';
import { Box, IconButton } from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import type { ComponentProps } from 'react';

import { getHeaderButtonBackground } from './headerButtonColors';

/** A fixed touch target with centered content for both icons and avatars. */
export function HeaderIconButton({
  children,
  colors,
  ...props
}: ComponentProps<typeof IconButton>) {
  const theme = useAppTheme();
  return (
    <Box contentAlignment="center" modifiers={[size(48, 48)]}>
      <IconButton
        {...props}
        colors={{ containerColor: getHeaderButtonBackground(theme.isDark), ...colors }}
      >
        <Box contentAlignment="center" modifiers={[size(36, 36)]}>
          {children}
        </Box>
      </IconButton>
    </Box>
  );
}
