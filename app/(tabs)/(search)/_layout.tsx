import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import {
  nativeStackTransitionProps,
  useNativeStackScreenListeners,
} from '@/components/navigation/useNativeStackScreenListeners';
import { useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: '(root)' };

function SearchLayout() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const screenListeners = useNativeStackScreenListeners('search');
  const stackOptions = useNativeListStackOptions(theme.colors.background);
  return (
    <Stack
      unstable_nativeProps={nativeStackTransitionProps('search')}
      screenListeners={screenListeners}
      screenOptions={stackOptions}
    >
      <Stack.Screen name="(root)" options={{ title: tr('search.title'), headerShown: false }} />
      {GroupedStackRoutes()}
    </Stack>
  );
}
export default withOuterTheme(SearchLayout);
