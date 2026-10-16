import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

export default function HomeLayout() {
  const theme = useAppTheme();
  const screenListeners = usePerformanceStackScreenListeners('home');
  const stackOptions = useNativeListStackOptions(theme.colors.background);
  return (
    <Stack screenListeners={screenListeners} screenOptions={stackOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerLargeTitle: false,
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerBlurEffect: 'none',
          headerShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
      <Stack.Screen name="folder/[id]" options={{ title: '查看全部' }} />
      <Stack.Screen name="view-all/[type]" options={{ title: '查看全部' }} />
    </Stack>
  );
}
