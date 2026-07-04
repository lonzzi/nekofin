import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { useAppTheme } from '@/lib/theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function HomeLayout() {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;

  return (
    <Stack
      screenOptions={{
        freezeOnBlur: true,
        headerTransparent: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerBlurEffect: isLiquidGlassAvailable() ? undefined : 'prominent',
        headerBackButtonDisplayMode: 'minimal',
        headerLargeStyle: {
          backgroundColor: isLiquidGlassAvailable() ? undefined : backgroundColor,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '搜索',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
    </Stack>
  );
}
