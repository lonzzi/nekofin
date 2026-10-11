import { getNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';

function HomeLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.backgroundGrouped;
  const stackScreenListeners = usePerformanceStackScreenListeners('settings');

  return (
    <Stack
      initialRouteName="index"
      screenListeners={stackScreenListeners}
      screenOptions={{
        ...getNativeListStackOptions(backgroundColor),
        headerTintColor: theme.colors.tint,
        headerTitleStyle: { color: theme.colors.text },
        headerLargeTitleStyle: { color: theme.colors.text },
      }}
    >
      <Stack.Screen name="playback" options={{ title: '播放与画质' }} />
      <Stack.Screen name="audio" options={{ title: '音频与字幕' }} />
      <Stack.Screen name="about" options={{ title: '帮助与关于' }} />
      <Stack.Screen
        name="index"
        options={{
          title: '设置',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="danmaku"
        options={{
          headerTitle: '弹幕设置',
        }}
      />
      <Stack.Screen
        name="performance"
        options={{
          headerTitle: '性能分析',
        }}
      />
      <Stack.Screen
        name="cache"
        options={{
          headerTitle: '存储管理',
        }}
      />
    </Stack>
  );
}

export default withOuterTheme(HomeLayout);
