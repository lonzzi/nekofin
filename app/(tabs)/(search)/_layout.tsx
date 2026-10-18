import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { TabletChromeContext } from '@/components/navigation/TabletChromeContext';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';

function SearchLayout() {
  const theme = useAppTheme();
  const screenListeners = usePerformanceStackScreenListeners('search');
  const stackOptions = useNativeListStackOptions(theme.colors.background);
  const chrome = useContext(TabletChromeContext);
  const stack = (
    <Stack screenListeners={screenListeners} screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: '搜索' }} />
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
