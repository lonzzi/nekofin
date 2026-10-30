import { useTranslation } from '@/lib/i18n';
import {
  NAVIGATION_CONTROL_GAP,
  NAVIGATION_CONTROL_SIZE,
  NAVIGATION_ICON_SIZE,
} from '@/lib/navigationMetrics';
import { useAppTheme } from '@/lib/theme';
import { Box, Host, Icon } from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { useRouter } from 'expo-router';

import { HeaderIconButton } from './HeaderIconButton.android';
import type { PlatformHeaderOptions } from './platformHeaderOptions';

function HeaderBackButton() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <Host
      style={{
        width: NAVIGATION_CONTROL_SIZE + NAVIGATION_CONTROL_GAP,
        height: NAVIGATION_CONTROL_SIZE,
      }}
      colorScheme={theme.colorScheme}
      matchContents
    >
      <Box
        contentAlignment="centerStart"
        modifiers={[
          size(NAVIGATION_CONTROL_SIZE + NAVIGATION_CONTROL_GAP, NAVIGATION_CONTROL_SIZE),
        ]}
      >
        <HeaderIconButton onClick={() => router.back()}>
          <Icon
            source={require('../../assets/drawables/chevron_left.xml')}
            size={NAVIGATION_ICON_SIZE}
            tint={theme.colors.text}
            contentDescription={tr('common.back')}
          />
        </HeaderIconButton>
      </Box>
    </Host>
  );
}

export const platformHeaderOptions: PlatformHeaderOptions = {
  headerBackVisible: false,
  headerLeft: ({ canGoBack }) => (canGoBack ? <HeaderBackButton /> : null),
};
