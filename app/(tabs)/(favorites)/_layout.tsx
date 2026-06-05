import { GroupedStackRoutes } from '@/components/GroupedStackRoutes';
import { getSystemColor } from '@/constants/SystemColor';
import { useColorScheme } from '@/hooks/useColorScheme';
import { isGreaterThanOrEqual26 } from '@/lib/utils';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function HomeLayout() {
  const colorScheme = useColorScheme();
  const backgroundColor = getSystemColor('systemBackground', colorScheme);

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
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '收藏',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      {GroupedStackRoutes()}
    </Stack>
  );
}
