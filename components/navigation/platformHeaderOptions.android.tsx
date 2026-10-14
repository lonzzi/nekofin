import { useAppTheme } from '@/lib/theme';
import { Host, Icon } from '@expo/ui/jetpack-compose';
import { useRouter } from 'expo-router';

import { HeaderIconButton } from './HeaderIconButton.android';
import type { PlatformHeaderOptions } from './platformHeaderOptions';

function HeaderBackButton() {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <Host style={{ width: 48, height: 48 }} colorScheme={theme.colorScheme} matchContents>
      <HeaderIconButton onClick={() => router.back()}>
        <Icon
          source={require('../../assets/drawables/chevron_left.png')}
          size={24}
          tint={theme.colors.text}
          contentDescription="返回"
        />
      </HeaderIconButton>
    </Host>
  );
}

export const platformHeaderOptions: PlatformHeaderOptions = {
  headerBackVisible: false,
  headerLeft: ({ canGoBack }) => (canGoBack ? <HeaderBackButton /> : null),
};
