import { useNativeListStackOptions } from '@/components/navigation/nativeListStackOptions';
import { usePerformanceStackScreenListeners } from '@/lib/performance/PerformanceMonitorContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { Stack } from 'expo-router';

function HomeLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.backgroundGrouped;
  const stackScreenListeners = usePerformanceStackScreenListeners('settings');

  const stackOptions = useNativeListStackOptions(backgroundColor);
  return (
    <Stack
      initialRouteName="index"
      screenListeners={stackScreenListeners}
      screenOptions={{
        ...stackOptions,
        headerTintColor: theme.colors.tint,
        headerTitleStyle: { color: theme.colors.text },
        headerLargeTitleStyle: { color: theme.colors.text },
      }}
    >
      <Stack.Screen name="playback" options={{ title: '播放与画质' }} />
      <Stack.Screen name="audio" options={{ title: '音频与字幕' }} />
      <Stack.Screen name="subtitle-fonts" options={{ title: '字幕字体' }} />
      <Stack.Screen name="subtitle-font-url" options={{ title: '从 URL 导入' }} />
      <Stack.Screen name="about" options={{ title: '帮助与关于' }} />
      <Stack.Screen
        name="index"
        options={{
          title: '设置',
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="danmaku"
        options={{
          headerTitle: '弹幕设置',
        }}
      />
      <Stack.Screen name="danmaku-sources" options={{ title: '弹幕 API' }} />
      <Stack.Screen name="danmaku-source/[id]" options={{ title: '弹幕 API' }} />
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
