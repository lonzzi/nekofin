import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { TabletChromeContext } from '@/components/navigation/TabletChromeContext';
import {
  nativeStackTransitionProps,
  useNativeStackScreenListeners,
} from '@/components/navigation/useNativeStackScreenListeners';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';

function SearchLayout() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const screenListeners = useNativeStackScreenListeners('search');
  const stackOptions = useNativeListStackOptions(theme.colors.background);
  const chrome = useContext(TabletChromeContext);
  const stack = (
    <Stack
      unstable_nativeProps={nativeStackTransitionProps('search')}
      screenListeners={screenListeners}
      screenOptions={stackOptions}
    >
      <Stack.Screen name="index" options={{ title: tr('search.title') }} />
      {GroupedStackRoutes()}
    </Stack>
  );
  // Keep search below the floating tabs without moving the other tab stacks
  // while their native transition is still drawing the outgoing screen.
  return chrome ? (
    <View style={{ flex: 1, paddingTop: chrome.toolbarHeight }}>{stack}</View>
  ) : (
    stack
  );
}
export default withOuterTheme(SearchLayout);
