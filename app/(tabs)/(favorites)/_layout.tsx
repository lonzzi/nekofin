import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

export default function FavoritesLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const stackScreenListeners = usePerformanceStackScreenListeners('favorites');

  const stackOptions = useNativeListStackOptions(backgroundColor);
  return (
    <Stack
      screenListeners={stackScreenListeners}
      screenOptions={{
        ...stackOptions,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '我的收藏',
          headerLargeTitleShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
    </Stack>
  );
}
