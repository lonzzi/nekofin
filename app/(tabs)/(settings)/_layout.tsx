import { isPerformanceDiagnosticsEnabled } from '@/lib/performance/performanceConfig';
import { useAppTheme } from '@/lib/theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
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
        name="transcoding"
        options={{
          headerTitle: '转码设置',
        }}
      />
      {isPerformanceDiagnosticsEnabled ? (
        <Stack.Screen
          name="performance"
          options={{
            headerTitle: '性能分析',
          }}
        />
      ) : null}
    </Stack>
  );
}
