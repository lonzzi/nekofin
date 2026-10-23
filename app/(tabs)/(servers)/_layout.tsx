import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { useTranslation } from '@/lib/i18n';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { Stack } from 'expo-router';

export default function ServersLayout() {
  const { t: tr } = useTranslation();
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
          title: tr('navigation.servers'),
          headerTitle: tr('navigation.servers'),
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
          title: tr('navigation.favorites'),
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="server-search"
        options={{
          title: tr('search.title'),
          headerLargeTitleShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
      <Stack.Screen
        name="folder/[id]"
        options={{
          title: tr('common.viewAll'),
        }}
      />
      <Stack.Screen
        name="view-all/[type]"
        options={{
          title: tr('common.viewAll'),
        }}
      />
      <Stack.Screen
        name="server-config/[serverId]"
        options={{
          title: tr('server.configuration'),
        }}
      />
      <Stack.Screen name="server-lines/[serverId]" options={{ title: tr('server.connections') }} />
      <Stack.Screen name="server-accounts/[serverId]" options={{ title: tr('server.accounts') }} />
      <Stack.Screen name="server-line/[serverId]" options={{ title: tr('server.addConnection') }} />
      <Stack.Screen
        name="add-server/[serverType]"
        options={{
          title: tr('server.addServer'),
        }}
      />
    </Stack>
  );
}
