import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function ServersLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.backgroundGrouped;
  const libraryBackgroundColor = theme.colors.background;
  const stackScreenListeners = usePerformanceStackScreenListeners('servers');

  return (
    <Stack
      screenListeners={stackScreenListeners}
      screenOptions={{
        headerTransparent: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerBlurEffect: isLiquidGlassAvailable() ? undefined : 'prominent',
        headerBackButtonDisplayMode: 'minimal',
        headerLargeStyle: {
          backgroundColor: isLiquidGlassAvailable() ? undefined : backgroundColor,
        },
        contentStyle: {
          backgroundColor,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '服务器',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="library"
        options={{
          title: '',
          contentStyle: {
            backgroundColor: libraryBackgroundColor,
          },
          headerBlurEffect: 'none',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="favorites"
        options={{
          title: '收藏',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="server-search"
        options={{
          title: '搜索',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
      <Stack.Screen
        name="folder/[id]"
        options={{
          title: '查看全部',
        }}
      />
      <Stack.Screen
        name="view-all/[type]"
        options={{
          title: '查看全部',
        }}
      />
      <Stack.Screen
        name="server-config/[serverId]"
        options={{
          title: '服务器配置',
        }}
      />
      <Stack.Screen
        name="add-server/[serverType]"
        options={{
          title: '添加服务器',
        }}
      />
    </Stack>
  );
}
