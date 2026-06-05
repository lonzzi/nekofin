import { useAppTheme } from '@/lib/design-system';
import { isGreaterThanOrEqual26 } from '@/lib/utils';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function HomeLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.backgroundGrouped;

  return (
    <Stack
      screenOptions={{
        headerTransparent: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerBlurEffect: isGreaterThanOrEqual26 ? undefined : 'prominent',
        headerBackButtonDisplayMode: 'minimal',
        headerLargeStyle: {
          backgroundColor: isGreaterThanOrEqual26 ? undefined : backgroundColor,
        },
        contentStyle: {
          backgroundColor,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '设置',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="media"
        options={{
          headerTitle: '媒体',
        }}
      />
      <Stack.Screen
        name="danmaku"
        options={{
          headerTitle: '弹幕设置',
        }}
      />
      <Stack.Screen
        name="transcoding"
        options={{
          headerTitle: '转码设置',
        }}
      />
      <Stack.Screen
        name="server-config/[serverId]"
        options={{
          headerTitle: '服务器配置',
        }}
      />
    </Stack>
  );
}
