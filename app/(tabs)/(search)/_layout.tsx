import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { getNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';

function SearchLayout() {
  const theme = useAppTheme();
  const screenListeners = usePerformanceStackScreenListeners('search');
  return (
    <Stack
      screenListeners={screenListeners}
      screenOptions={getNativeListStackOptions(theme.colors.background)}
    >
      <Stack.Screen name="index" options={{ title: '搜索' }} />
      {GroupedStackRoutes()}
    </Stack>
  );
}
export default withOuterTheme(SearchLayout);
