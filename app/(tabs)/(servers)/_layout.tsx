import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

export default function ServersLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.backgroundGrouped;
  const libraryBackgroundColor = theme.colors.background;
  const stackScreenListeners = usePerformanceStackScreenListeners('servers');

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
          title: '服务器',
          headerTitle: '服务器',
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="library"
        options={{
          title: '',
          headerLargeTitle: false,
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
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="server-search"
        options={{
          title: '搜索',
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
      <Stack.Screen name="server-lines/[serverId]" options={{ title: '服务器线路' }} />
      <Stack.Screen name="server-accounts/[serverId]" options={{ title: '服务器账号' }} />
      <Stack.Screen name="server-line/[serverId]" options={{ title: '添加线路' }} />
      <Stack.Screen
        name="add-server/[serverType]"
        options={{
          title: '添加服务器',
        }}
      />
    </Stack>
  );
}
