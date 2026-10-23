import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { useTranslation } from '@/lib/i18n';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

export default function HomeLayout() {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const screenListeners = usePerformanceStackScreenListeners('home');
  const stackOptions = useNativeListStackOptions(theme.colors.background);
  return (
    <Stack screenListeners={screenListeners} screenOptions={stackOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerTitle: '',
          headerLargeTitle: false,
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerBlurEffect: 'none',
          headerShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
      <Stack.Screen name="carousel-libraries" options={{ title: tr('home.featuredLibraries') }} />
      <Stack.Screen name="folder/[id]" options={{ title: tr('common.viewAll') }} />
      <Stack.Screen name="view-all/[type]" options={{ title: tr('common.viewAll') }} />
    </Stack>
  );
}
