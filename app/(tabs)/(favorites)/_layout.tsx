import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { getNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

export default function FavoritesLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const stackScreenListeners = usePerformanceStackScreenListeners('favorites');

  return (
    <Stack
      screenListeners={stackScreenListeners}
      screenOptions={{
        ...getNativeListStackOptions(backgroundColor),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '我的收藏',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
    </Stack>
  );
}
